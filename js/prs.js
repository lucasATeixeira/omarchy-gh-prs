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
 */

/** @typedef {"failing"|"running"|"passing"|"none"} Status */

/** @typedef {"APPROVED"|"CHANGES_REQUESTED"|"REVIEW_REQUIRED"} ReviewDecision */

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
 * @property {Status} status
 * @property {boolean} aiReviewDone
 * @property {?ReviewDecision} reviewDecision Null when the repo requires no review.
 * @property {number} unresolvedThreadCount
 * @property {boolean} hasConflict
 */

/**
 * The outcome of one fetch; `error` is empty on success.
 * @typedef {Object} FetchResult
 * @property {PullRequest[]} prs
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
 * Whether the checks include an AI Check and every AI Check has finished.
 * @param {CheckContext[]} checks
 * @param {string[]} patterns Lowercase substrings of an AI Check's name.
 * @returns {boolean}
 */
function aiReviewDone(checks, patterns) {
    var aiChecks = checks.filter(function (check) {
        var name = checkName(check).toLowerCase();
        return patterns.some(function (pattern) { return name.indexOf(pattern) !== -1; });
    });
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

/** GraphQL query for the user's 50 most recently updated open PRs and the fields each row shows. */
var QUERY = "query { viewer { login } search(query: \"is:pr is:open author:@me sort:updated-desc\", type: ISSUE, first: 50) {"
    + " nodes { ... on PullRequest { id number title url isDraft updatedAt reviewDecision mergeable repository { nameWithOwner }"
    + " reviewThreads(first: 100) { nodes { isResolved } }"
    + " commits(last: 1) { nodes { commit { statusCheckRollup { contexts(first: 100) { nodes {"
    + " __typename ... on CheckRun { name status conclusion } ... on StatusContext { context state } } } } } } } } } } }";

/**
 * Turns one `gh api graphql` run with QUERY into the PRs to show, or an error.
 * @param {number} exitCode
 * @param {string} stdout
 * @param {string} stderr
 * @param {string} aiCheckNames The `aiCheckNames` setting; empty means no AI Checks.
 * @returns {FetchResult}
 */
function parseRun(exitCode, stdout, stderr, aiCheckNames) {
    if (exitCode !== 0) return { prs: [], error: errorMessage(stderr, exitCode) };
    try {
        var patterns = aiCheckPatterns(aiCheckNames);
        var data = JSON.parse(stdout).data;
        return {
            prs: data.search.nodes.map(function (node) { return toPullRequest(node, patterns); }),
            viewerLogin: data.viewer.login,
            error: ""
        };
    } catch (e) {
        return { prs: [], error: "Unexpected response from gh" };
    }
}

function toPullRequest(node, aiCheckPatterns) {
    var rollup = node.commits.nodes[0].commit.statusCheckRollup;
    var checks = rollup ? rollup.contexts.nodes : [];
    return {
        id: node.id,
        repo: node.repository.nameWithOwner,
        number: node.number,
        title: node.title,
        url: node.url,
        isDraft: node.isDraft,
        updatedAt: node.updatedAt,
        status: prStatus(checks),
        aiReviewDone: aiReviewDone(checks, aiCheckPatterns),
        reviewDecision: node.reviewDecision,
        unresolvedThreadCount: node.reviewThreads.nodes.filter(function (thread) { return !thread.isResolved; }).length,
        hasConflict: node.mergeable === "CONFLICTING"
    };
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
 * What the details query read about one PR.
 * @typedef {Object} PrDetails
 * @property {string} id The PR's node id.
 * @property {PrState} state
 * @property {string} actor Login of who merged or closed the PR; empty when it was never closed.
 */

/**
 * The outcome of one details run; `error` is empty on success.
 * @typedef {Object} DetailsResult
 * @property {PrDetails[]} details
 * @property {string} error
 */

/** GraphQL query for the state of the PRs in `$ids` and who merged or closed each one. */
var DETAILS_QUERY = "query($ids: [ID!]!) { nodes(ids: $ids) { ... on PullRequest { id state mergedBy { login }"
    + " timelineItems(itemTypes: [CLOSED_EVENT], last: 1) { nodes { ... on ClosedEvent { actor { login } } } } } } }";

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
    var actor = node.state === "MERGED" ? node.mergedBy.login : closedEvent ? closedEvent.actor.login : "";
    return { id: node.id, state: node.state, actor: actor };
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
        return { setting: "notifyAiReviewDone", title: "AI review done", pr: pr };
    });
    var ci = finishedCi(previousPrs, currentPrs).map(function (pr) {
        return { setting: ciNotificationSetting(pr.status), title: ciNotificationTitle(pr.status), pr: pr };
    });
    return aiReviews.concat(ci, mergedOrClosed(previousPrs, currentPrs, details || [], viewerLogin));
}

var MERGED_OR_CLOSED = {
    MERGED: { setting: "notifyMerged", verb: "merged" },
    CLOSED: { setting: "notifyClosed", verb: "closed" }
};

/**
 * Notifications for PRs missing since the previous poll that someone other than the viewer merged or closed.
 * @param {?PullRequest[]} previousPrs
 * @param {PullRequest[]} currentPrs
 * @param {PrDetails[]} details
 * @param {string} viewerLogin
 * @returns {Notification[]}
 */
function mergedOrClosed(previousPrs, currentPrs, details, viewerLogin) {
    var notifications = [];
    missingSincePoll(previousPrs, currentPrs).forEach(function (pr) {
        var prDetails = details.find(function (d) { return d.id === pr.id; });
        var event = prDetails && MERGED_OR_CLOSED[prDetails.state];
        if (!event || prDetails.actor === viewerLogin) return;
        notifications.push({ setting: event.setting, title: "PR " + event.verb + " by " + prDetails.actor, pr: pr });
    });
    return notifications;
}

/**
 * Current PRs that `changed` accepts against the same PR, matched by URL, in the previous poll.
 * @param {?PullRequest[]} previousPrs
 * @param {PullRequest[]} currentPrs
 * @param {function(PullRequest, PullRequest): boolean} changed Gets the previous and the current PR.
 * @returns {PullRequest[]}
 */
function changedSincePoll(previousPrs, currentPrs, changed) {
    var previous = previousPrs || [];
    return currentPrs.filter(function (now) {
        var before = previous.find(function (pr) { return pr.url === now.url; });
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
 * Ids of the PRs the details query must read: those missing since the previous poll.
 * @param {?PullRequest[]} previousPrs Null before the first successful poll.
 * @param {PullRequest[]} currentPrs
 * @returns {string[]}
 */
function prIdsNeedingDetails(previousPrs, currentPrs) {
    return missingSincePoll(previousPrs, currentPrs).map(function (pr) { return pr.id; });
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
 * @property {string} [aiCheckNames]
 * @property {boolean} [notificationsEnabled]
 * @property {boolean} [notifyAiReviewDone]
 * @property {boolean} [notifyCiPassed]
 * @property {boolean} [notifyCiFailed]
 * @property {boolean} [notifyMerged]
 * @property {boolean} [notifyClosed]
 */

/** @typedef {"notifyAiReviewDone"|"notifyCiPassed"|"notifyCiFailed"|"notifyMerged"|"notifyClosed"} NotificationSetting */

var REFRESH_INTERVAL_MIN_SEC = 5;
var REFRESH_INTERVAL_MAX_SEC = 3600;
var REFRESH_INTERVAL_DEFAULT_SEC = 10;

/**
 * The `refreshIntervalSec` setting as whole seconds within the allowed range; the default when it is not a number.
 * @param {unknown} value
 * @returns {number}
 */
function refreshIntervalSec(value) {
    var seconds = Math.round(Number(value));
    if (!isFinite(seconds)) return REFRESH_INTERVAL_DEFAULT_SEC;
    return Math.min(REFRESH_INTERVAL_MAX_SEC, Math.max(REFRESH_INTERVAL_MIN_SEC, seconds));
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
 * @param {"notificationsEnabled"|NotificationSetting} key
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
        refreshIntervalSec: refreshIntervalSec,
        parseAiCheckPatterns: parseAiCheckPatterns,
        addAiCheckPatterns: addAiCheckPatterns,
        joinAiCheckPatterns: joinAiCheckPatterns,
        removeAiCheckPattern: removeAiCheckPattern,
        barSummary: barSummary,
        sections: sections,
        errorMessage: errorMessage,
        DEFAULT_COLORS: DEFAULT_COLORS,
        themeColors: themeColors
    };
}
