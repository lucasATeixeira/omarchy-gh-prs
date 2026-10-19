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
 * Splits the `aiCheckNames` setting into lowercase patterns, dropping blank ones.
 * @param {string} aiCheckNames
 * @returns {string[]}
 */
function aiCheckPatterns(aiCheckNames) {
    return aiCheckNames.split(",")
        .map(function (pattern) { return pattern.trim().toLowerCase(); })
        .filter(function (pattern) { return pattern !== ""; });
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
var QUERY = "query { search(query: \"is:pr is:open author:@me sort:updated-desc\", type: ISSUE, first: 50) {"
    + " nodes { ... on PullRequest { number title url isDraft updatedAt reviewDecision mergeable repository { nameWithOwner }"
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
        var nodes = JSON.parse(stdout).data.search.nodes;
        return { prs: nodes.map(function (node) { return toPullRequest(node, patterns); }), error: "" };
    } catch (e) {
        return { prs: [], error: "Unexpected response from gh" };
    }
}

function toPullRequest(node, aiCheckPatterns) {
    var rollup = node.commits.nodes[0].commit.statusCheckRollup;
    var checks = rollup ? rollup.contexts.nodes : [];
    return {
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

if (typeof module !== "undefined") {
    module.exports = {
        QUERY: QUERY,
        prStatus: prStatus,
        parseRun: parseRun,
        finishedAiReviews: finishedAiReviews,
        finishedCi: finishedCi,
        ciNotificationTitle: ciNotificationTitle,
        barSummary: barSummary,
        sections: sections,
        errorMessage: errorMessage,
        DEFAULT_COLORS: DEFAULT_COLORS,
        themeColors: themeColors
    };
}
