.pragma library

// Pure logic for the GitHub PR widget: CI status rules, grouping, and parsing `gh` output.

/**
 * A check as GitHub's GraphQL API returns it inside a status check rollup.
 * @typedef {Object} CheckContext
 * @property {string} __typename "CheckRun" or "StatusContext".
 * @property {string} [name] CheckRun name.
 * @property {string} [context] StatusContext name.
 * @property {string} [status] CheckRun progress, e.g. "IN_PROGRESS" or "COMPLETED".
 * @property {?string} [conclusion] CheckRun result once completed.
 * @property {string} [state] StatusContext state.
 * @property {number} [databaseId] CheckRun id; a later run has a higher id.
 * @property {{workflowRun: ?{workflow: {name: string}}}} [checkSuite] CheckRun suite; app checks have no workflow run.
 */

/**
 * A review thread as GitHub's GraphQL API returns it, with only its first comment.
 * @typedef {Object} ReviewThreadNode
 * @property {boolean} isResolved
 * @property {{nodes: {author: ?{login: string}}[]}} comments
 */

/**
 * A review request event as GitHub's GraphQL API returns it.
 * @typedef {Object} ReviewRequestNode
 * @property {string} createdAt ISO 8601 timestamp.
 * @property {?{isViewer?: boolean, combinedSlug?: string}} requestedReviewer A User has `isViewer` and a Team has `combinedSlug`. Other reviewers have neither, and a deleted one is null.
 */

/**
 * The logged-in user as GitHub's GraphQL API returns it, with the teams the user is in.
 * @typedef {Object} ViewerNode
 * @property {string} login
 * @property {{nodes: {teams: {nodes: {combinedSlug: string}[]}}[]}} organizations
 */

/** @typedef {"failing"|"running"|"passing"|"none"} Status */

/** @typedef {"APPROVED"|"CHANGES_REQUESTED"|"REVIEW_REQUIRED"} ReviewDecision */

/** @typedef {"APPROVED"|"CHANGES_REQUESTED"|"COMMENTED"|"DISMISSED"|"PENDING"} ReviewState */

/**
 * A reviewer's latest Review on a PR.
 * @typedef {Object} Review
 * @property {string} id
 * @property {ReviewState} state
 * @property {string} author Login of the reviewer.
 */

/**
 * An open pull request as the widget shows it.
 * @typedef {Object} PullRequest
 * @property {string} id GitHub node id.
 * @property {string} repo "owner/name".
 * @property {number} number
 * @property {string} title
 * @property {string} url
 * @property {boolean} isDraft
 * @property {string} updatedAt ISO 8601 timestamp.
 * @property {string} reviewRequestedAt ISO 8601 timestamp of the latest Review request, or of the PR's creation when there is none.
 * @property {string} author Login of who opened the PR.
 * @property {Status} status
 * @property {boolean} aiReviewDone
 * @property {boolean} aiChangesSuggested The AI review is done and an AI thread is unresolved.
 * @property {boolean} aiReviewClean The AI review is done and no AI thread is unresolved.
 * @property {?ReviewDecision} reviewDecision Null when the repo requires no review.
 * @property {number} unresolvedThreadCount
 * @property {number} approvalCount Number of Approvals.
 * @property {boolean} hasConflict
 * @property {Review[]} latestReviews One per reviewer.
 */

/**
 * The outcome of one fetch; `error` is empty on success.
 * @typedef {Object} FetchResult
 * @property {PullRequest[]} prs The Authored PRs.
 * @property {PullRequest[]} prsToReview
 * @property {string} [viewerLogin] The logged-in user; set on success.
 * @property {string} error
 */

var RUNNING_STATES = ["PENDING", "EXPECTED"];
var PASSED_STATES = ["SUCCESS", "NEUTRAL", "SKIPPED"];

/**
 * Classifies one check; a completed run with an unknown conclusion counts as failing.
 * @param {CheckContext} check
 * @returns {Status}
 */
function checkStatus(check) {
    if (check.__typename === "CheckRun" && check.status !== "COMPLETED") return "running";
    var result = check.__typename === "CheckRun" ? check.conclusion : check.state;
    if (PASSED_STATES.indexOf(result) !== -1) return "passing";
    if (RUNNING_STATES.indexOf(result) !== -1) return "running";
    return "failing";
}

/**
 * @param {CheckContext} check
 * @returns {string}
 */
function checkName(check) {
    return check.__typename === "CheckRun" ? check.name : check.context;
}

/**
 * Keeps only the latest run of each CI job.
 * @param {CheckContext[]} checks
 * @returns {CheckContext[]}
 */
function latestChecks(checks) {
    return checks.filter(function (check) {
        return check.__typename !== "CheckRun" || !checks.some(function (other) {
            return other.__typename === "CheckRun" && jobName(other) === jobName(check) && other.databaseId > check.databaseId;
        });
    });
}

/**
 * The CheckRun name, after its workflow name when it has one.
 * @param {CheckContext} check A CheckRun.
 * @returns {string}
 */
function jobName(check) {
    var workflowRun = check.checkSuite.workflowRun;
    return workflowRun ? workflowRun.workflow.name + " / " + check.name : check.name;
}

/**
 * Combines a PR's checks: any failure wins, then anything unfinished.
 * @param {CheckContext[]} checks
 * @returns {Status}
 */
function prStatus(checks) {
    return worstStatus(checks.map(checkStatus));
}

/**
 * Splits the `aiCheckNames` setting into AI check patterns as typed, dropping blank ones and case-insensitive duplicates.
 * @param {string} aiCheckNames
 * @returns {string[]}
 */
function parseAiCheckPatterns(aiCheckNames) {
    var seen = [];
    return aiCheckNames.split(",")
        .map(function (pattern) { return pattern.trim(); })
        .filter(function (pattern) {
            var key = pattern.toLowerCase();
            if (pattern === "" || seen.indexOf(key) !== -1) return false;
            seen.push(key);
            return true;
        });
}

/**
 * Adds each comma-separated part of `text` to the patterns, skipping blank parts and patterns already there.
 * @param {string[]} patterns
 * @param {string} text
 * @returns {string[]}
 */
function addAiCheckPatterns(patterns, text) {
    return parseAiCheckPatterns(patterns.concat(text).join(","));
}

/**
 * The `aiCheckNames` setting that stores the patterns.
 * @param {string[]} patterns
 * @returns {string}
 */
function joinAiCheckPatterns(patterns) {
    return patterns.join(", ");
}

/**
 * The patterns without one of them.
 * @param {string[]} patterns
 * @param {string} pattern
 * @returns {string[]}
 */
function removeAiCheckPattern(patterns, pattern) {
    return patterns.filter(function (other) { return other !== pattern; });
}

/**
 * Splits the `aiCheckNames` setting into lowercase patterns for matching.
 * @param {string} aiCheckNames
 * @returns {string[]}
 */
function aiCheckPatterns(aiCheckNames) {
    return parseAiCheckPatterns(aiCheckNames).map(function (pattern) { return pattern.toLowerCase(); });
}

/**
 * Whether the name contains any AI check pattern, ignoring case.
 * @param {string} name
 * @param {string[]} patterns Lowercase AI check patterns.
 * @returns {boolean}
 */
function matchesAiCheckPattern(name, patterns) {
    var lowerName = name.toLowerCase();
    return patterns.some(function (pattern) { return lowerName.indexOf(pattern) !== -1; });
}

/**
 * Whether the checks include an AI Check and every AI Check has finished.
 * @param {CheckContext[]} checks
 * @param {string[]} patterns Lowercase AI check patterns.
 * @returns {boolean}
 */
function aiReviewDone(checks, patterns) {
    var aiChecks = checks.filter(function (check) { return matchesAiCheckPattern(checkName(check), patterns); });
    return aiChecks.length > 0 && aiChecks.every(function (check) { return checkStatus(check) !== "running"; });
}

/** Statuses from worst to best. */
var STATUS_ORDER = ["failing", "running", "passing", "none"];

/**
 * @param {Status[]} statuses
 * @returns {Status}
 */
function worstStatus(statuses) {
    for (var i = 0; i < STATUS_ORDER.length; i++) {
        if (statuses.indexOf(STATUS_ORDER[i]) !== -1) return STATUS_ORDER[i];
    }
    return "none";
}

/**
 * What the bar shows: the worst status among the PRs and how many PRs have it.
 * @typedef {Object} BarSummary
 * @property {Status} status
 * @property {number} count Zero when status is "none".
 */

/**
 * @param {PullRequest[]} prs
 * @returns {BarSummary}
 */
function barSummary(prs) {
    var status = worstStatus(prs.map(function (pr) { return pr.status; }));
    if (status === "none") return { status: status, count: 0 };
    return { status: status, count: prs.filter(function (pr) { return pr.status === status; }).length };
}

var MS_PER_MINUTE = 60 * 1000;
var MS_PER_DAY = 24 * 60 * MS_PER_MINUTE;

/** @typedef {"updatedAt"|"reviewRequestedAt"} AgeStart The PR timestamp a Tab measures age from. */

/**
 * The PRs that are not Stale: their `ageStart` is at most `maxAgeDays` × 24 hours before `now`.
 * @param {PullRequest[]} prs
 * @param {number} maxAgeDays
 * @param {number} now Milliseconds since the epoch.
 * @param {AgeStart} ageStart
 * @returns {PullRequest[]}
 */
function withoutStalePrs(prs, maxAgeDays, now, ageStart) {
    var oldestAllowed = now - maxAgeDays * MS_PER_DAY;
    return prs.filter(function (pr) { return Date.parse(pr[ageStart]) >= oldestAllowed; });
}

/**
 * Says how long before `now` the Last refresh was, rounding down.
 * @param {number} lastRefresh Milliseconds since the epoch.
 * @param {number} now Milliseconds since the epoch.
 * @returns {string}
 */
function refreshLabel(lastRefresh, now) {
    var minutes = Math.floor((now - lastRefresh) / MS_PER_MINUTE);
    if (minutes < 1) return "Refreshed just now";
    if (minutes < 60) return "Refreshed " + minutes + " min ago";
    var hours = Math.floor(minutes / 60);
    if (hours < 24) return "Refreshed " + hours + " h ago";
    return "Refreshed " + Math.floor(hours / 24) + " d ago";
}

/**
 * Whether a reviewer's latest Review is an Approval.
 * @param {Review} review
 * @returns {boolean}
 */
function isApproval(review) {
    return review.state === "APPROVED";
}

/**
 * The PRs where the viewer's latest Review is not an Approval.
 * @param {PullRequest[]} prs
 * @param {string} viewerLogin
 * @returns {PullRequest[]}
 */
function withoutMyApprovedPrs(prs, viewerLogin) {
    return prs.filter(function (pr) {
        return !pr.latestReviews.some(function (review) {
            return review.author === viewerLogin && isApproval(review);
        });
    });
}

var SECTION_TITLES = { failing: "Failing", running: "Running", passing: "Passing", none: "No CI" };

/**
 * One titled group of PRs in the panel.
 * @typedef {Object} Section
 * @property {Status} status
 * @property {string} title
 * @property {PullRequest[]} prs
 */

/**
 * Groups PRs by status, worst first, newest PR first inside each group.
 * @param {PullRequest[]} prs
 * @returns {Section[]}
 */
function sections(prs) {
    var newestFirst = prs.slice().sort(function (a, b) { return b.updatedAt.localeCompare(a.updatedAt); });
    return STATUS_ORDER
        .map(function (status) {
            return {
                status: status,
                title: SECTION_TITLES[status],
                prs: newestFirst.filter(function (pr) { return pr.status === status; })
            };
        })
        .filter(function (section) { return section.prs.length > 0; });
}

/** @typedef {"authored"|"toReview"} TabName */

/**
 * One Tab of the popup and the PRs it lists.
 * @typedef {Object} Tab
 * @property {TabName} name
 * @property {string} label
 * @property {PullRequest[]} prs
 * @property {string} emptyText
 * @property {boolean} showAuthor Whether rows show who opened the PR.
 */

/**
 * The popup's Tabs in order.
 * @param {PullRequest[]} authoredPrs
 * @param {PullRequest[]} prsToReview
 * @param {boolean} showCounts False until the first successful poll.
 * @returns {Tab[]}
 */
function tabs(authoredPrs, prsToReview, showCounts) {
    var count = function (prs) { return showCounts ? " " + prs.length : ""; };
    return [
        { name: "authored", label: "Authored" + count(authoredPrs), prs: authoredPrs, emptyText: "No open pull requests", showAuthor: false },
        { name: "toReview", label: "To review" + count(prsToReview), prs: prsToReview, emptyText: "No PRs to review", showAuthor: true }
    ];
}

/** GraphQL query for the viewer's teams and the 50 most recently updated Authored PRs and PRs to review, with the fields each row shows. */
var QUERY = "query { viewer { login organizations(first: 100) { nodes { teams(first: 100, role: MEMBER) { nodes { combinedSlug } } } } }"
    + " authoredPrs: search(query: \"is:pr is:open author:@me sort:updated-desc\", type: ISSUE, first: 50) { nodes { ...PrFields } }"
    + " prsToReview: search(query: \"is:pr is:open review-requested:@me sort:updated-desc\", type: ISSUE, first: 50) { nodes { ...PrFields } } }"
    + " fragment PrFields on PullRequest { id number title url isDraft createdAt updatedAt author { login } reviewDecision mergeable repository { nameWithOwner }"
    + " timelineItems(itemTypes: [REVIEW_REQUESTED_EVENT], last: 20) { nodes { ... on ReviewRequestedEvent { createdAt requestedReviewer { ... on User { isViewer } ... on Team { combinedSlug } } } } }"
    + " reviewThreads(first: 100) { nodes { isResolved comments(first: 1) { nodes { author { login } } } } }"
    + " latestReviews(first: 20) { nodes { id state author { login } } }"
    + " commits(last: 1) { nodes { commit { statusCheckRollup { contexts(first: 100) { nodes {"
    + " __typename ... on CheckRun { name status conclusion databaseId checkSuite { workflowRun { workflow { name } } } } ... on StatusContext { context state } } } } } } } }";

/**
 * Turns one `gh api graphql` run with QUERY into the PRs to show, or an error.
 * @param {number} exitCode
 * @param {string} stdout
 * @param {string} stderr
 * @param {string} aiCheckNames The `aiCheckNames` setting; empty means no AI Checks.
 * @returns {FetchResult}
 */
function parseRun(exitCode, stdout, stderr, aiCheckNames) {
    if (exitCode !== 0) return { prs: [], prsToReview: [], error: errorMessage(stderr, exitCode) };
    try {
        var patterns = aiCheckPatterns(aiCheckNames);
        var data = JSON.parse(stdout).data;
        var teams = viewerTeams(data.viewer);
        var toPullRequests = function (search) {
            return search.nodes.map(function (node) { return toPullRequest(node, patterns, teams); });
        };
        return {
            prs: toPullRequests(data.authoredPrs),
            prsToReview: toPullRequests(data.prsToReview),
            viewerLogin: data.viewer.login,
            error: ""
        };
    } catch (e) {
        return { prs: [], prsToReview: [], error: "Unexpected response from gh" };
    }
}

function toPullRequest(node, aiCheckPatterns, teams) {
    var rollup = node.commits.nodes[0].commit.statusCheckRollup;
    var checks = rollup ? latestChecks(rollup.contexts.nodes) : [];
    var latestReviews = node.latestReviews.nodes.map(toReview);
    var isAiReviewDone = aiReviewDone(checks, aiCheckPatterns);
    var hasAiThread = node.reviewThreads.nodes.some(function (thread) { return isAiThread(thread, aiCheckPatterns); });
    return {
        id: node.id,
        repo: node.repository.nameWithOwner,
        number: node.number,
        title: node.title,
        url: node.url,
        isDraft: node.isDraft,
        updatedAt: node.updatedAt,
        reviewRequestedAt: latestReviewRequestAt(node.timelineItems.nodes, teams) || node.createdAt,
        author: userLogin(node.author),
        status: prStatus(checks),
        aiReviewDone: isAiReviewDone,
        aiChangesSuggested: isAiReviewDone && hasAiThread,
        aiReviewClean: isAiReviewDone && !hasAiThread,
        reviewDecision: node.reviewDecision,
        unresolvedThreadCount: node.reviewThreads.nodes.filter(function (thread) { return !thread.isResolved; }).length,
        approvalCount: latestReviews.filter(isApproval).length,
        hasConflict: node.mergeable === "CONFLICTING",
        latestReviews: latestReviews
    };
}

/**
 * Whether the thread is unresolved and an AI reviewer wrote its first comment.
 * @param {ReviewThreadNode} thread
 * @param {string[]} patterns Lowercase AI check patterns.
 * @returns {boolean}
 */
function isAiThread(thread, patterns) {
    return !thread.isResolved && matchesAiCheckPattern(userLogin(thread.comments.nodes[0].author), patterns);
}

/**
 * The "org/slug" of every team the viewer is in.
 * @param {ViewerNode} viewer
 * @returns {string[]}
 */
function viewerTeams(viewer) {
    var teams = [];
    viewer.organizations.nodes.forEach(function (organization) {
        organization.teams.nodes.forEach(function (team) { teams.push(team.combinedSlug); });
    });
    return teams;
}

/**
 * When the latest Review request happened: a request to the viewer or to one of `teams`; empty when there is none.
 * @param {ReviewRequestNode[]} requests Oldest first.
 * @param {string[]} teams The viewer's teams.
 * @returns {string}
 */
function latestReviewRequestAt(requests, teams) {
    var reviewRequests = requests.filter(function (request) {
        var reviewer = request.requestedReviewer;
        return reviewer !== null && (reviewer.isViewer === true || teams.indexOf(reviewer.combinedSlug) !== -1);
    });
    return reviewRequests.length > 0 ? reviewRequests[reviewRequests.length - 1].createdAt : "";
}

function toReview(node) {
    return { id: node.id, state: node.state, author: userLogin(node.author) };
}

function userLogin(user) {
    // GitHub returns no user for a deleted account and shows it as "ghost".
    return user ? user.login : "ghost";
}

/**
 * PRs whose AI review was not done in the previous poll and is done now.
 * A PR missing from the previous poll is skipped, and so is every PR on the first poll.
 * @param {?PullRequest[]} previousPrs Null before the first successful poll.
 * @param {PullRequest[]} currentPrs
 * @returns {PullRequest[]}
 */
function finishedAiReviews(previousPrs, currentPrs) {
    return changedSincePoll(previousPrs, currentPrs, function (before, now) {
        return !before.aiReviewDone && now.aiReviewDone;
    });
}

/**
 * PRs whose CI finished: running in the previous poll, and failing or passing now.
 * A PR missing from the previous poll is skipped, and so is every PR on the first poll.
 * @param {?PullRequest[]} previousPrs Null before the first successful poll.
 * @param {PullRequest[]} currentPrs
 * @returns {PullRequest[]}
 */
function finishedCi(previousPrs, currentPrs) {
    return changedSincePoll(previousPrs, currentPrs, function (before, now) {
        return before.status === "running" && (now.status === "failing" || now.status === "passing");
    });
}

/**
 * Title of the notification sent when a PR's CI finishes.
 * @param {Status} status "passing" or "failing".
 * @returns {string}
 */
function ciNotificationTitle(status) {
    return status === "passing" ? "CI passed" : "CI failed";
}

/**
 * A desktop notification about a PR, sent only when its setting is on.
 * @typedef {Object} Notification
 * @property {NotificationSetting} setting
 * @property {string} title
 * @property {PullRequest} pr
 */

/** @typedef {"OPEN"|"MERGED"|"CLOSED"} PrState */

/**
 * A comment in a review thread of a PR.
 * @typedef {Object} CodeComment
 * @property {string} author Login of the writer.
 * @property {string} publishedAt ISO 8601 timestamp.
 */

/**
 * What the details query read about one PR.
 * @typedef {Object} PrDetails
 * @property {string} id The PR's node id.
 * @property {PrState} state
 * @property {string} actor Login of who merged or closed the PR; empty when it was never closed.
 * @property {CodeComment[]} codeComments The latest comments of each review thread.
 */

/**
 * The outcome of one details run; `error` is empty on success.
 * @typedef {Object} DetailsResult
 * @property {PrDetails[]} details
 * @property {string} error
 */

/** GraphQL query for the state of the PRs in `$ids`, who merged or closed each one, and their latest Code comments. */
var DETAILS_QUERY = "query($ids: [ID!]!) { nodes(ids: $ids) { ... on PullRequest { id state mergedBy { login }"
    + " timelineItems(itemTypes: [CLOSED_EVENT], last: 1) { nodes { ... on ClosedEvent { actor { login } } } }"
    + " reviewThreads(first: 100) { nodes { comments(last: 20) { nodes { publishedAt author { login } } } } } } } }";

/**
 * The `gh` command that runs DETAILS_QUERY for these PR ids.
 * @param {string[]} ids
 * @returns {string[]}
 */
function detailsCommand(ids) {
    var command = ["gh", "api", "graphql", "-f", "query=" + DETAILS_QUERY];
    ids.forEach(function (id) { command.push("-f", "ids[]=" + id); });
    return command;
}

/**
 * Turns one `gh api graphql` run with DETAILS_QUERY into PR details, or an error.
 * @param {number} exitCode
 * @param {string} stdout
 * @param {string} stderr
 * @returns {DetailsResult}
 */
function parseDetailsRun(exitCode, stdout, stderr) {
    if (exitCode !== 0) return { details: [], error: errorMessage(stderr, exitCode) };
    try {
        return { details: JSON.parse(stdout).data.nodes.map(toPrDetails), error: "" };
    } catch (e) {
        return { details: [], error: "Unexpected response from gh" };
    }
}

function toPrDetails(node) {
    var closedEvent = node.timelineItems.nodes[0];
    var actor = node.state === "MERGED" ? userLogin(node.mergedBy) : closedEvent ? userLogin(closedEvent.actor) : "";
    var codeComments = [];
    node.reviewThreads.nodes.forEach(function (thread) {
        thread.comments.nodes.forEach(function (comment) {
            codeComments.push({ author: userLogin(comment.author), publishedAt: comment.publishedAt });
        });
    });
    return { id: node.id, state: node.state, actor: actor, codeComments: codeComments };
}

/**
 * The notifications one successful poll sends, compared with the previous successful poll.
 * @param {?PullRequest[]} previousPrs Null before the first successful poll.
 * @param {PullRequest[]} currentPrs
 * @param {?PrDetails[]} details Null when the details query did not run or failed.
 * @param {string} viewerLogin
 * @returns {Notification[]}
 */
function pollNotifications(previousPrs, currentPrs, details, viewerLogin) {
    var aiReviews = finishedAiReviews(previousPrs, currentPrs).map(function (pr) {
        var title = pr.aiChangesSuggested ? "AI review: changes suggested" : "AI review: no changes suggested";
        return { setting: "notifyAiReviewDone", title: title, pr: pr };
    });
    var ci = finishedCi(previousPrs, currentPrs).map(function (pr) {
        return { setting: ciNotificationSetting(pr.status), title: ciNotificationTitle(pr.status), pr: pr };
    });
    return aiReviews.concat(ci, reviewNotifications(previousPrs, currentPrs),
        codeCommentNotifications(previousPrs, currentPrs, details || [], viewerLogin),
        mergedOrClosedNotifications(previousPrs, currentPrs, details || [], viewerLogin));
}

/**
 * One notification per PR that has Code comments from others published after the previous poll's `updatedAt`.
 * @param {?PullRequest[]} previousPrs
 * @param {PullRequest[]} currentPrs
 * @param {PrDetails[]} details
 * @param {string} viewerLogin
 * @returns {Notification[]}
 */
function codeCommentNotifications(previousPrs, currentPrs, details, viewerLogin) {
    var notifications = [];
    currentPrs.forEach(function (now) {
        var before = previousPr(previousPrs, now);
        var prDetails = detailsFor(details, now);
        if (before === undefined || prDetails === undefined) return;
        var newComments = prDetails.codeComments.filter(function (comment) {
            return comment.publishedAt > before.updatedAt && comment.author !== viewerLogin;
        });
        if (newComments.length === 0) return;
        var title = newComments.length === 1
            ? "New code comment from " + newComments[0].author
            : newComments.length + " new code comments";
        notifications.push({ setting: "notifyCodeComments", title: title, pr: now });
    });
    return notifications;
}

/**
 * The details of one PR, matched by node id.
 * @param {PrDetails[]} details
 * @param {PullRequest} pr
 * @returns {PrDetails|undefined}
 */
function detailsFor(details, pr) {
    return details.find(function (d) { return d.id === pr.id; });
}

/**
 * How a PR state or Review state is announced.
 * @typedef {Object} StateNotification
 * @property {NotificationSetting} setting
 * @property {string} titlePrefix Followed by the login of who caused the state.
 */

/** PR states that notify; other states send nothing. */
var MERGED_OR_CLOSED = {
    MERGED: { setting: "notifyMerged", titlePrefix: "PR merged by " },
    CLOSED: { setting: "notifyClosed", titlePrefix: "PR closed by " }
};

/**
 * Notifications for PRs missing since the previous poll that someone other than the viewer merged or closed.
 * @param {?PullRequest[]} previousPrs
 * @param {PullRequest[]} currentPrs
 * @param {PrDetails[]} details
 * @param {string} viewerLogin
 * @returns {Notification[]}
 */
function mergedOrClosedNotifications(previousPrs, currentPrs, details, viewerLogin) {
    var notifications = [];
    missingSincePoll(previousPrs, currentPrs).forEach(function (pr) {
        var prDetails = detailsFor(details, pr);
        var event = prDetails && MERGED_OR_CLOSED[prDetails.state];
        if (!event || prDetails.actor === viewerLogin) return;
        notifications.push({ setting: event.setting, title: event.titlePrefix + prDetails.actor, pr: pr });
    });
    return notifications;
}

/** Review states that notify; other states send nothing. */
var REVIEW_NOTIFICATIONS = {
    APPROVED: { setting: "notifyApproved", titlePrefix: "Approved by " },
    CHANGES_REQUESTED: { setting: "notifyChangesRequested", titlePrefix: "Changes requested by " }
};

/**
 * One notification per approving or changes-requesting Review whose id the same PR did not have in the previous poll.
 * @param {?PullRequest[]} previousPrs
 * @param {PullRequest[]} currentPrs
 * @returns {Notification[]}
 */
function reviewNotifications(previousPrs, currentPrs) {
    var notifications = [];
    currentPrs.forEach(function (now) {
        var before = previousPr(previousPrs, now);
        if (before === undefined) return;
        var seenIds = before.latestReviews.map(function (review) { return review.id; });
        now.latestReviews.forEach(function (review) {
            var kind = REVIEW_NOTIFICATIONS[review.state];
            if (kind && seenIds.indexOf(review.id) === -1) {
                notifications.push({ setting: kind.setting, title: kind.titlePrefix + review.author, pr: now });
            }
        });
    });
    return notifications;
}

/**
 * The same PR, matched by URL, in the previous poll.
 * @param {?PullRequest[]} previousPrs
 * @param {PullRequest} now
 * @returns {PullRequest|undefined}
 */
function previousPr(previousPrs, now) {
    return (previousPrs || []).find(function (pr) { return pr.url === now.url; });
}

/**
 * Current PRs that `changed` accepts against the same PR in the previous poll.
 * @param {?PullRequest[]} previousPrs
 * @param {PullRequest[]} currentPrs
 * @param {function(PullRequest, PullRequest): boolean} changed Gets the previous and the current PR.
 * @returns {PullRequest[]}
 */
function changedSincePoll(previousPrs, currentPrs, changed) {
    return currentPrs.filter(function (now) {
        var before = previousPr(previousPrs, now);
        return before !== undefined && changed(before, now);
    });
}

/**
 * PRs of the previous poll that are not in the current one, matched by URL.
 * @param {?PullRequest[]} previousPrs
 * @param {PullRequest[]} currentPrs
 * @returns {PullRequest[]}
 */
function missingSincePoll(previousPrs, currentPrs) {
    return (previousPrs || []).filter(function (before) {
        return !currentPrs.some(function (now) { return now.url === before.url; });
    });
}

/**
 * Ids of the PRs the details query must read: those missing since the previous poll, or whose `updatedAt` changed.
 * @param {?PullRequest[]} previousPrs Null before the first successful poll.
 * @param {PullRequest[]} currentPrs
 * @returns {string[]}
 */
function prIdsNeedingDetails(previousPrs, currentPrs) {
    var updated = changedSincePoll(previousPrs, currentPrs, function (before, now) {
        return before.updatedAt !== now.updatedAt;
    });
    return missingSincePoll(previousPrs, currentPrs).concat(updated).map(function (pr) { return pr.id; });
}

/**
 * Turns a failed `gh` run into a message for the panel; auth failures get a login hint.
 * @param {string} stderr
 * @param {number} exitCode
 * @returns {string}
 */
function errorMessage(stderr, exitCode) {
    if (stderr.indexOf("gh auth login") !== -1) return "Not logged in to GitHub. Run: gh auth login";
    return stderr.trim() || "gh exited with code " + exitCode;
}

/**
 * Hex colors for the three CI states that have one.
 * @typedef {Object} StatusColors
 * @property {string} failing
 * @property {string} running
 * @property {string} passing
 */

/** @type {StatusColors} */
var DEFAULT_COLORS = { failing: "#d75f5f", running: "#d6a84b", passing: "#5fa46b" };

/**
 * Reads the status colors from a theme's colors.toml, falling back to its terminal palette.
 * @param {string} toml
 * @returns {StatusColors}
 */
function themeColors(toml) {
    function pick(names, fallback) {
        for (var i = 0; i < names.length; i++) {
            var match = toml.match(new RegExp("^\\s*" + names[i] + "\\s*=\\s*[\"']?(#[0-9A-Fa-f]{6})", "m"));
            if (match) return match[1];
        }
        return fallback;
    }
    return {
        failing: pick(["red", "color1"], DEFAULT_COLORS.failing),
        running: pick(["yellow", "color3"], DEFAULT_COLORS.running),
        passing: pick(["green", "color2"], DEFAULT_COLORS.passing)
    };
}

/**
 * The widget's entry in `shell.json`, as far as this widget reads it.
 * @typedef {Object} WidgetSettings
 * @property {number} [refreshIntervalSec]
 * @property {number} [authoredMaxAgeDays]
 * @property {number} [toReviewMaxAgeDays]
 * @property {boolean} [hideMyApprovedPrs]
 * @property {string} [aiCheckNames]
 * @property {boolean} [notificationsEnabled]
 * @property {boolean} [notifyAiReviewDone]
 * @property {boolean} [notifyCiPassed]
 * @property {boolean} [notifyCiFailed]
 * @property {boolean} [notifyApproved]
 * @property {boolean} [notifyChangesRequested]
 * @property {boolean} [notifyCodeComments]
 * @property {boolean} [notifyMerged]
 * @property {boolean} [notifyClosed]
 */

/**
 * @typedef {"notifyAiReviewDone"|"notifyCiPassed"|"notifyCiFailed"|"notifyApproved"|"notifyChangesRequested"
 *     |"notifyCodeComments"|"notifyMerged"|"notifyClosed"} NotificationSetting
 */

/**
 * `value` rounded to a whole number within `min` and `max`; `fallback` when it is not a number.
 * @param {unknown} value
 * @param {number} min
 * @param {number} max
 * @param {number} fallback
 * @returns {number}
 */
function wholeNumberInRange(value, min, max, fallback) {
    // Number(null) and Number("") are 0, so they would pass as a number.
    var number = value === null || value === "" ? NaN : Math.round(Number(value));
    if (!isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
}

var REFRESH_INTERVAL_MIN_SEC = 5;
var REFRESH_INTERVAL_MAX_SEC = 3600;
var REFRESH_INTERVAL_DEFAULT_SEC = 30;

/**
 * The `refreshIntervalSec` setting as whole seconds within the allowed range; the default when it is not a number.
 * @param {unknown} value
 * @returns {number}
 */
function refreshIntervalSec(value) {
    return wholeNumberInRange(value, REFRESH_INTERVAL_MIN_SEC, REFRESH_INTERVAL_MAX_SEC, REFRESH_INTERVAL_DEFAULT_SEC);
}

var MAX_AGE_MIN_DAYS = 1;
var MAX_AGE_MAX_DAYS = 365;
var MAX_AGE_DEFAULT_DAYS = 365;

/**
 * A Tab's max-age setting as whole days within the allowed range; the default when it is not a number.
 * @param {unknown} value
 * @returns {number}
 */
function maxAgeDays(value) {
    return wholeNumberInRange(value, MAX_AGE_MIN_DAYS, MAX_AGE_MAX_DAYS, MAX_AGE_DEFAULT_DAYS);
}

/**
 * The setting that turns the CI notification for this status on or off.
 * @param {Status} status
 * @returns {NotificationSetting}
 */
function ciNotificationSetting(status) {
    return status === "passing" ? "notifyCiPassed" : "notifyCiFailed";
}

/**
 * Whether a boolean setting is on; a missing key counts as on.
 * @param {WidgetSettings} settings
 * @param {"hideMyApprovedPrs"|"notificationsEnabled"|NotificationSetting} key
 * @returns {boolean}
 */
function settingOn(settings, key) {
    return settings[key] !== false;
}

/**
 * Whether a notification may be sent: the master switch and its own setting are both on.
 * @param {WidgetSettings} settings
 * @param {NotificationSetting} key
 * @returns {boolean}
 */
function notificationEnabled(settings, key) {
    return settingOn(settings, "notificationsEnabled") && settingOn(settings, key);
}

if (typeof module !== "undefined") {
    module.exports = {
        QUERY: QUERY,
        prStatus: prStatus,
        parseRun: parseRun,
        finishedAiReviews: finishedAiReviews,
        finishedCi: finishedCi,
        ciNotificationTitle: ciNotificationTitle,
        ciNotificationSetting: ciNotificationSetting,
        pollNotifications: pollNotifications,
        prIdsNeedingDetails: prIdsNeedingDetails,
        DETAILS_QUERY: DETAILS_QUERY,
        detailsCommand: detailsCommand,
        parseDetailsRun: parseDetailsRun,
        notificationEnabled: notificationEnabled,
        settingOn: settingOn,
        REFRESH_INTERVAL_MIN_SEC: REFRESH_INTERVAL_MIN_SEC,
        REFRESH_INTERVAL_MAX_SEC: REFRESH_INTERVAL_MAX_SEC,
        REFRESH_INTERVAL_DEFAULT_SEC: REFRESH_INTERVAL_DEFAULT_SEC,
        refreshIntervalSec: refreshIntervalSec,
        MAX_AGE_MIN_DAYS: MAX_AGE_MIN_DAYS,
        MAX_AGE_MAX_DAYS: MAX_AGE_MAX_DAYS,
        MAX_AGE_DEFAULT_DAYS: MAX_AGE_DEFAULT_DAYS,
        maxAgeDays: maxAgeDays,
        parseAiCheckPatterns: parseAiCheckPatterns,
        addAiCheckPatterns: addAiCheckPatterns,
        joinAiCheckPatterns: joinAiCheckPatterns,
        removeAiCheckPattern: removeAiCheckPattern,
        barSummary: barSummary,
        withoutStalePrs: withoutStalePrs,
        refreshLabel: refreshLabel,
        withoutMyApprovedPrs: withoutMyApprovedPrs,
        sections: sections,
        tabs: tabs,
        errorMessage: errorMessage,
        DEFAULT_COLORS: DEFAULT_COLORS,
        themeColors: themeColors
    };
}
