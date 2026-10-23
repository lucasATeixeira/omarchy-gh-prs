'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { loadQmlLibrary } = require('./load.js')

const P = loadQmlLibrary('js/prs.js')

let nextRunId = 1
const run = (status, conclusion, name = 'tests', workflow = null, databaseId = nextRunId++) => ({
  __typename: 'CheckRun', name, status, conclusion, databaseId, checkSuite: { workflowRun: workflow && { workflow: { name: workflow } } }
})
const ctx = (state, context = 'ci/lint') => ({ __typename: 'StatusContext', context, state })

describe('prStatus', () => {
  it('is failing when any check failed, even while others run', () => {
    assert.equal(P.prStatus([run('COMPLETED', 'SUCCESS'), run('IN_PROGRESS', null), run('COMPLETED', 'FAILURE')]), 'failing')
  })

  it('treats every failure conclusion and state as failing', () => {
    for (const c of ['FAILURE', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED', 'STARTUP_FAILURE']) {
      assert.equal(P.prStatus([run('COMPLETED', c)]), 'failing', c)
    }
    assert.equal(P.prStatus([ctx('FAILURE')]), 'failing')
    assert.equal(P.prStatus([ctx('ERROR')]), 'failing')
  })

  it('is running when nothing failed and a check is unfinished', () => {
    for (const s of ['QUEUED', 'IN_PROGRESS', 'PENDING', 'WAITING', 'REQUESTED']) {
      assert.equal(P.prStatus([run('COMPLETED', 'SUCCESS'), run(s, null)]), 'running', s)
    }
    assert.equal(P.prStatus([ctx('PENDING')]), 'running')
    assert.equal(P.prStatus([ctx('EXPECTED')]), 'running')
  })

  it('is passing when every check succeeded, was neutral, or was skipped', () => {
    assert.equal(P.prStatus([run('COMPLETED', 'SUCCESS'), run('COMPLETED', 'NEUTRAL'), run('COMPLETED', 'SKIPPED'), ctx('SUCCESS')]), 'passing')
  })

  it('is none when the PR has no checks', () => {
    assert.equal(P.prStatus([]), 'none')
  })
})

const prNode = (overrides) => Object.assign({
  id: 'PR_7',
  number: 7,
  title: 'Add widget',
  url: 'https://github.com/acme/app/pull/7',
  isDraft: false,
  createdAt: '2026-10-18T10:00:00Z',
  updatedAt: '2026-10-19T10:00:00Z',
  timelineItems: { nodes: [] },
  author: { login: 'alice' },
  reviewDecision: 'APPROVED',
  reviewThreads: { nodes: [] },
  latestReviews: { nodes: [] },
  mergeable: 'MERGEABLE',
  repository: { nameWithOwner: 'acme/app' },
  commits: { nodes: [{ commit: { statusCheckRollup: { contexts: { nodes: [run('COMPLETED', 'FAILURE')] } } } }] }
}, overrides)

const response = (nodes, toReviewNodes = [], teams = []) => JSON.stringify({
  data: {
    viewer: { login: 'me', organizations: { nodes: [{ teams: { nodes: teams.map((combinedSlug) => ({ combinedSlug })) } }] } },
    authoredPrs: { nodes },
    prsToReview: { nodes: toReviewNodes }
  }
})

describe('parseRun success', () => {
  it('turns search results into pull requests with their CI status', () => {
    assert.deepEqual(P.parseRun(0, response([prNode()]), '', ''), {
      prs: [{
        id: 'PR_7',
        repo: 'acme/app',
        number: 7,
        title: 'Add widget',
        url: 'https://github.com/acme/app/pull/7',
        isDraft: false,
        updatedAt: '2026-10-19T10:00:00Z',
        reviewRequestedAt: '2026-10-18T10:00:00Z',
        author: 'alice',
        status: 'failing',
        aiReviewDone: false,
        aiChangesSuggested: false,
        aiReviewClean: false,
        reviewDecision: 'APPROVED',
        unresolvedThreadCount: 0,
        approvalCount: 0,
        hasConflict: false,
        latestReviews: []
      }],
      prsToReview: [],
      viewerLogin: 'me',
      error: ''
    })
  })

  it('gives status none to a PR without a check rollup', () => {
    const node = prNode({ commits: { nodes: [{ commit: { statusCheckRollup: null } }] } })
    assert.equal(P.parseRun(0, response([node]), '', '').prs[0].status, 'none')
  })

  it('reports output that is not JSON', () => {
    assert.equal(P.parseRun(0, '<html>', '', '').error, 'Unexpected response from gh')
  })
})

const pr = (status, updatedAt = '2026-10-19T10:00:00Z', number = 1) => ({ repo: 'acme/app', number, title: 't', url: 'u', isDraft: false, updatedAt, status })

describe('barSummary', () => {
  it('shows only the worst state and how many PRs are in it', () => {
    const prs = [pr('passing'), pr('running'), pr('failing'), pr('running'), pr('passing')]
    assert.deepEqual(P.barSummary(prs), { status: 'failing', count: 1 })
    assert.deepEqual(P.barSummary(prs.filter(p => p.status !== 'failing')), { status: 'running', count: 2 })
    assert.deepEqual(P.barSummary([pr('passing'), pr('none'), pr('passing')]), { status: 'passing', count: 2 })
  })

  it('is none when no PR has CI', () => {
    assert.deepEqual(P.barSummary([]), { status: 'none', count: 0 })
    assert.deepEqual(P.barSummary([pr('none')]), { status: 'none', count: 0 })
  })
})

describe('sections', () => {
  it('groups PRs as Failing, Running, Passing, No CI and hides empty groups', () => {
    const result = P.sections([pr('none'), pr('passing'), pr('failing')])
    assert.deepEqual(result.map(s => [s.status, s.title, s.prs.length]), [
      ['failing', 'Failing', 1],
      ['passing', 'Passing', 1],
      ['none', 'No CI', 1]
    ])
  })

  it('lists the most recently updated PR first', () => {
    const older = pr('running', '2026-10-18T10:00:00Z', 1)
    const newer = pr('running', '2026-10-19T09:00:00Z', 2)
    assert.deepEqual(P.sections([older, newer])[0].prs.map(p => p.number), [2, 1])
  })

  it('is empty when there are no PRs', () => {
    assert.deepEqual(P.sections([]), [])
  })
})

describe('themeColors', () => {
  it('reads red, yellow and green from the theme colors.toml', () => {
    const toml = 'accent = "#89b4fa"\nred = "#f38ba8"\nyellow = "#f9e2af"\ngreen = "#a6e3a1"\nbright_red = "#ff0000"\n'
    assert.deepEqual(P.themeColors(toml), { failing: '#f38ba8', running: '#f9e2af', passing: '#a6e3a1' })
  })

  it('falls back to terminal colors 1, 3 and 2', () => {
    const toml = 'color1 = "#110000"\ncolor2 = "#001100"\ncolor3 = "#111100"\n'
    assert.deepEqual(P.themeColors(toml), { failing: '#110000', running: '#111100', passing: '#001100' })
  })

  it('uses fixed colors when the theme defines none', () => {
    assert.deepEqual(P.themeColors(''), P.DEFAULT_COLORS)
  })
})

describe('errorMessage', () => {
  it('tells the user to log in when gh is not authenticated', () => {
    const stderr = 'To get started with GitHub CLI, please run:  gh auth login\nAlternatively, populate the GH_TOKEN environment variable.\n'
    assert.equal(P.errorMessage(stderr, 4), 'Not logged in to GitHub. Run: gh auth login')
  })

  it('shows what gh printed', () => {
    assert.equal(P.errorMessage('  error connecting to api.github.com\n', 1), 'error connecting to api.github.com')
  })

  it('falls back to the exit code when gh printed nothing', () => {
    assert.equal(P.errorMessage('', 2), 'gh exited with code 2')
  })
})

const withChecks = (checks) => prNode({ commits: { nodes: [{ commit: { statusCheckRollup: { contexts: { nodes: checks } } } }] } })
const aiReviewDoneFor = (checks, aiCheckNames = 'CodeRabbit') => P.parseRun(0, response([withChecks(checks)]), '', aiCheckNames).prs[0].aiReviewDone

describe('parseRun AI review', () => {
  it('is done when the AI check finished, even while other checks run', () => {
    assert.equal(aiReviewDoneFor([ctx('SUCCESS', 'CodeRabbit'), run('IN_PROGRESS', null)]), true)
  })

  it('waits for every AI check', () => {
    const checks = [ctx('SUCCESS', 'CodeRabbit'), run('IN_PROGRESS', null, 'Cursor Bugbot')]
    assert.equal(aiReviewDoneFor(checks, 'coderabbit, bugbot'), false)
  })

  it('counts a failed AI check as done', () => {
    assert.equal(aiReviewDoneFor([run('COMPLETED', 'FAILURE', 'claude-review')], 'claude'), true)
  })

  it('is not done without a matching AI check', () => {
    assert.equal(aiReviewDoneFor([run('COMPLETED', 'SUCCESS')]), false)
  })

  it('is off when the setting has only blank names', () => {
    assert.equal(aiReviewDoneFor([ctx('SUCCESS', 'CodeRabbit')], ' , '), false)
  })

  it('is not done for a PR without a check rollup', () => {
    const node = prNode({ commits: { nodes: [{ commit: { statusCheckRollup: null } }] } })
    assert.equal(P.parseRun(0, response([node]), '', 'CodeRabbit').prs[0].aiReviewDone, false)
  })
})

const statusFor = (checks) => P.parseRun(0, response([withChecks(checks)]), '', '').prs[0].status

describe('parseRun repeated runs', () => {
  it('drops a run that a later run of the same job replaced', () => {
    const checks = [run('COMPLETED', 'SUCCESS', 'tests', 'PR Tests', 8), run('COMPLETED', 'CANCELLED', 'tests', 'PR Tests', 7)]
    assert.equal(statusFor(checks), 'passing')
  })

  it('runs while a rerun of a failed job runs', () => {
    const checks = [run('COMPLETED', 'FAILURE', 'tests', 'PR Tests', 7), run('IN_PROGRESS', null, 'tests', 'PR Tests', 8)]
    assert.equal(statusFor(checks), 'running')
  })

  it('keeps jobs with the same name in different workflows', () => {
    const checks = [run('COMPLETED', 'FAILURE', 'tests', 'Lint', 7), run('COMPLETED', 'SUCCESS', 'tests', 'PR Tests', 8)]
    assert.equal(statusFor(checks), 'failing')
  })

  it('matches app checks without a workflow by name', () => {
    const checks = [run('COMPLETED', 'FAILURE', 'Bugbot', null, 7), run('COMPLETED', 'SUCCESS', 'Bugbot', null, 8)]
    assert.equal(statusFor(checks), 'passing')
  })

  it('still fails on a cancelled run that nothing replaced', () => {
    assert.equal(statusFor([run('COMPLETED', 'CANCELLED', 'tests', 'PR Tests')]), 'failing')
  })
})

const reviewed = (number, done) => Object.assign(pr('running', undefined, number), { url: 'u' + number, aiReviewDone: done })

describe('finishedAiReviews', () => {
  it('lists PRs whose AI review finished since the last poll', () => {
    const previous = [reviewed(1, false), reviewed(2, false)]
    const current = [reviewed(1, true), reviewed(2, false)]
    assert.deepEqual(P.finishedAiReviews(previous, current).map(p => p.number), [1])
  })

  it('ignores PRs already done in the last poll', () => {
    assert.deepEqual(P.finishedAiReviews([reviewed(1, true)], [reviewed(1, true)]), [])
  })

  it('ignores PRs seen for the first time', () => {
    assert.deepEqual(P.finishedAiReviews([reviewed(1, false)], [reviewed(2, true)]), [])
  })

  it('ignores everything on the first poll', () => {
    assert.deepEqual(P.finishedAiReviews(null, [reviewed(1, true)]), [])
  })
})

const prWithCi = (number, status) => Object.assign(pr(status), { number, url: 'u' + number })

describe('finishedCi', () => {
  it('lists PRs whose CI went from running to passing or failing', () => {
    const previous = [prWithCi(1, 'running'), prWithCi(2, 'running')]
    const current = [prWithCi(1, 'passing'), prWithCi(2, 'failing')]
    assert.deepEqual(P.finishedCi(previous, current).map(p => p.number), [1, 2])
  })

  it('ignores every other status change', () => {
    const changes = [['passing', 'failing'], ['failing', 'passing'], ['running', 'none'], ['running', 'running']]
    for (const [before, now] of changes) {
      assert.deepEqual(P.finishedCi([prWithCi(1, before)], [prWithCi(1, now)]), [], before + ' -> ' + now)
    }
  })

  it('ignores PRs seen for the first time', () => {
    assert.deepEqual(P.finishedCi([prWithCi(1, 'running')], [prWithCi(2, 'passing')]), [])
  })

  it('ignores everything on the first poll', () => {
    assert.deepEqual(P.finishedCi(null, [prWithCi(1, 'passing')]), [])
  })
})

describe('ciNotificationTitle', () => {
  it('says whether CI passed or failed', () => {
    assert.equal(P.ciNotificationTitle('passing'), 'CI passed')
    assert.equal(P.ciNotificationTitle('failing'), 'CI failed')
  })
})

const reviewDecisionFor = (reviewDecision) => P.parseRun(0, response([prNode({ reviewDecision })]), '', '').prs[0].reviewDecision

describe('parseRun review decision', () => {
  it('keeps every review decision GitHub returns', () => {
    for (const decision of ['APPROVED', 'CHANGES_REQUESTED', 'REVIEW_REQUIRED']) {
      assert.equal(reviewDecisionFor(decision), decision)
    }
  })

  it('is null when the repo requires no review', () => {
    assert.equal(reviewDecisionFor(null), null)
  })
})

const latestReviewsFor = (reviews) => P.parseRun(0, response([prNode({ latestReviews: { nodes: reviews } })]), '', '').prs[0].latestReviews

describe('parseRun latest reviews', () => {
  it('reads each review id, state and author login', () => {
    const reviews = [{ id: 'R1', state: 'APPROVED', author: { login: 'ana' } }, { id: 'R2', state: 'COMMENTED', author: { login: 'bob' } }]
    assert.deepEqual(latestReviewsFor(reviews), [{ id: 'R1', state: 'APPROVED', author: 'ana' }, { id: 'R2', state: 'COMMENTED', author: 'bob' }])
  })

  it('names a deleted author ghost', () => {
    assert.equal(latestReviewsFor([{ id: 'R1', state: 'APPROVED', author: null }])[0].author, 'ghost')
  })
})

const reviewNode = (id, state) => ({ id, state, author: { login: 'user-' + id } })
const approvalCountFor = (reviews) => P.parseRun(0, response([prNode({ latestReviews: { nodes: reviews } })]), '', '').prs[0].approvalCount

describe('parseRun approvals', () => {
  it('counts Approvals', () => {
    assert.equal(approvalCountFor([reviewNode('R1', 'APPROVED'), reviewNode('R2', 'APPROVED')]), 2)
  })

  it('is 0 when the PR has no reviews', () => {
    assert.equal(approvalCountFor([]), 0)
  })

  it('ignores reviews that do not approve', () => {
    const reviews = [reviewNode('R1', 'APPROVED'), reviewNode('R2', 'CHANGES_REQUESTED'), reviewNode('R3', 'COMMENTED'), reviewNode('R4', 'PENDING')]
    assert.equal(approvalCountFor(reviews), 1)
  })

  it('ignores dismissed approvals', () => {
    assert.equal(approvalCountFor([reviewNode('R1', 'DISMISSED')]), 0)
  })
})

const thread = (isResolved, author = 'ana') => ({ isResolved, comments: { nodes: [commentNode(author)] } })
const unresolvedThreadCountFor = (threads) => P.parseRun(0, response([prNode({ reviewThreads: { nodes: threads } })]), '', '').prs[0].unresolvedThreadCount

describe('parseRun unresolved threads', () => {
  it('is 0 when the PR has no threads', () => {
    assert.equal(unresolvedThreadCountFor([]), 0)
  })

  it('is 0 when every thread is resolved', () => {
    assert.equal(unresolvedThreadCountFor([thread(true), thread(true)]), 0)
  })

  it('counts only unresolved threads', () => {
    assert.equal(unresolvedThreadCountFor([thread(false), thread(true), thread(false)]), 2)
  })
})

const aiReviewedNode = (threads, checks = [ctx('SUCCESS', 'CodeRabbit')]) => Object.assign(withChecks(checks), { reviewThreads: { nodes: threads } })
const aiChangesSuggestedFor = (threads, aiCheckNames = 'CodeRabbit') =>
  P.parseRun(0, response([aiReviewedNode(threads)]), '', aiCheckNames).prs[0].aiChangesSuggested

describe('parseRun AI changes suggested', () => {
  it('is true for an unresolved AI thread', () => {
    assert.equal(aiChangesSuggestedFor([thread(true), thread(false, 'coderabbitai')]), true)
  })

  it('ignores resolved AI threads', () => {
    assert.equal(aiChangesSuggestedFor([thread(true, 'coderabbitai')]), false)
  })

  it('ignores threads started by humans', () => {
    assert.equal(aiChangesSuggestedFor([thread(false, 'ana'), thread(false, 'bob')]), false)
  })

  it('ignores an AI reply to a human thread', () => {
    const humanThread = { isResolved: false, comments: { nodes: [commentNode('ana'), commentNode('coderabbitai')] } }
    assert.equal(aiChangesSuggestedFor([humanThread]), false)
  })

  it('waits for the AI review to be done', () => {
    const node = aiReviewedNode([thread(false, 'coderabbitai')], [ctx('PENDING', 'CodeRabbit')])
    assert.equal(P.parseRun(0, response([node]), '', 'CodeRabbit').prs[0].aiChangesSuggested, false)
  })

  it('matches logins ignoring case', () => {
    assert.equal(aiChangesSuggestedFor([thread(false, 'CodeRabbitAI')], 'coderabbit'), true)
  })

  it('is off without AI check patterns', () => {
    assert.equal(aiChangesSuggestedFor([thread(false, 'coderabbitai')], ''), false)
  })

  it('ignores a thread started by a deleted account', () => {
    assert.equal(aiChangesSuggestedFor([thread(false, null)]), false)
  })

  it('uses the same rule for PRs to review', () => {
    const result = P.parseRun(0, response([], [aiReviewedNode([thread(false, 'coderabbitai')])]), '', 'CodeRabbit')
    assert.equal(result.prsToReview[0].aiChangesSuggested, true)
  })
})

const aiReviewCleanFor = (node) => P.parseRun(0, response([node]), '', 'CodeRabbit').prs[0].aiReviewClean

describe('parseRun AI review clean', () => {
  it('is true when the AI review is done without AI threads', () => {
    assert.equal(aiReviewCleanFor(aiReviewedNode([thread(false, 'ana'), thread(true, 'coderabbitai')])), true)
  })

  it('is false when an AI thread is unresolved', () => {
    assert.equal(aiReviewCleanFor(aiReviewedNode([thread(false, 'coderabbitai')])), false)
  })

  it('waits for the AI review to be done', () => {
    assert.equal(aiReviewCleanFor(aiReviewedNode([], [ctx('PENDING', 'CodeRabbit')])), false)
  })
})

const hasConflictFor = (mergeable) => P.parseRun(0, response([prNode({ mergeable })]), '', '').prs[0].hasConflict

describe('parseRun conflict', () => {
  it('is true when the PR is conflicting', () => {
    assert.equal(hasConflictFor('CONFLICTING'), true)
  })

  it('is false when the PR is mergeable', () => {
    assert.equal(hasConflictFor('MERGEABLE'), false)
  })

  it('is false while GitHub has not computed mergeability', () => {
    assert.equal(hasConflictFor('UNKNOWN'), false)
  })
})

describe('QUERY', () => {
  it('reads the id and workflow of each check run', () => {
    assert.match(P.QUERY, /on CheckRun \{[^}]*\bdatabaseId\b/)
    assert.match(P.QUERY, /workflowRun \{ workflow \{ name \} \}/)
  })

  it('reads the review decision', () => {
    assert.match(P.QUERY, /\breviewDecision\b/)
  })

  it('reads whether each review thread is resolved', () => {
    assert.match(P.QUERY, /reviewThreads\(first: 100\)[^}]*\bisResolved\b/)
  })

  it('reads who started each review thread', () => {
    assert.match(P.QUERY, /reviewThreads\(first: 100\) \{ nodes \{ isResolved comments\(first: 1\) \{ nodes \{ author \{ login \} \} \} \} \}/)
  })

  it('reads each reviewer\'s latest review', () => {
    assert.match(P.QUERY, /latestReviews\(first: 20\) \{ nodes \{ id state author \{ login \} \} \}/)
  })

  it('reads whether the PR can merge', () => {
    assert.match(P.QUERY, /\bmergeable\b/)
  })

  it('reads the PR author', () => {
    assert.match(P.QUERY, /PrFields on PullRequest \{[^}]*\bauthor \{ login \}/)
  })

  it('reads the teams the viewer is in', () => {
    assert.match(P.QUERY, /viewer \{[^]*organizations\(first: 100\) \{ nodes \{ teams\(first: 100, role: MEMBER\) \{ nodes \{ combinedSlug \} \} \} \}/)
  })

  it('reads when the PR was created and whom each review request went to', () => {
    assert.match(P.QUERY, /PrFields on PullRequest \{[^}]*\bcreatedAt\b/)
    assert.match(P.QUERY, /timelineItems\(itemTypes: \[REVIEW_REQUESTED_EVENT\], last: 20\) \{ nodes \{ \.\.\. on ReviewRequestedEvent \{ createdAt requestedReviewer \{ \.\.\. on User \{ isViewer \} \.\.\. on Team \{ combinedSlug \} \} \} \} \}/)
  })

  it('reads the PR id and the viewer login', () => {
    assert.match(P.QUERY, /PullRequest \{ id\b/)
    assert.match(P.QUERY, /viewer \{ login\b/)
  })
})

describe('parseRun exit codes', () => {
  it('parses stdout when gh succeeds', () => {
    assert.equal(P.parseRun(0, response([prNode()]), '', '').prs[0].status, 'failing')
  })

  it('drops the PR list and reports the error when gh fails', () => {
    assert.deepEqual(P.parseRun(1, '', 'gh: Something went wrong\n'), { prs: [], prsToReview: [], error: 'gh: Something went wrong' })
  })
})

describe('parseRun PRs to review', () => {
  it('reads Authored PRs and PRs to review from their own search', () => {
    const toReview = prNode({ id: 'PR_9', number: 9, url: 'https://github.com/acme/app/pull/9' })
    const result = P.parseRun(0, response([prNode()], [toReview]), '', '')
    assert.deepEqual(result.prs.map((pr) => pr.number), [7])
    assert.deepEqual(result.prsToReview.map((pr) => pr.number), [9])
  })

  it('names a deleted PR author ghost', () => {
    assert.equal(P.parseRun(0, response([], [prNode({ author: null })]), '', '').prsToReview[0].author, 'ghost')
  })

  it('is empty when nothing waits for the viewer', () => {
    assert.deepEqual(P.parseRun(0, response([prNode()], []), '', '').prsToReview, [])
  })

  it('drops both lists on a broken response', () => {
    const result = P.parseRun(0, '<html>', '', '')
    assert.deepEqual([result.prs, result.prsToReview], [[], []])
  })
})

describe('tabs', () => {
  const authored = [pr('passing')]
  const toReview = [pr('failing'), pr('running')]

  it('lists Authored, then To review with the author shown', () => {
    assert.deepEqual(P.tabs(authored, toReview, true), [
      { name: 'authored', label: 'Authored 1', prs: authored, emptyText: 'No open pull requests', showAuthor: false },
      { name: 'toReview', label: 'To review 2', prs: toReview, emptyText: 'No PRs to review', showAuthor: true }
    ])
  })

  it('hides the counts before the first successful poll', () => {
    assert.deepEqual(P.tabs([], [], false).map((tab) => tab.label), ['Authored', 'To review'])
  })
})

describe('refreshIntervalSec', () => {
  it('keeps a value inside the range', () => {
    assert.equal(P.refreshIntervalSec(45), 45)
  })

  it('clamps to the allowed range', () => {
    assert.equal(P.refreshIntervalSec(1), 5)
    assert.equal(P.refreshIntervalSec(9000), 3600)
  })

  it('rounds to whole seconds', () => {
    assert.equal(P.refreshIntervalSec(12.6), 13)
  })

  it('reads numeric strings', () => {
    assert.equal(P.refreshIntervalSec('20'), 20)
  })

  it('falls back to the default for a value that is not a number', () => {
    assert.equal(P.refreshIntervalSec('soon'), 30)
    assert.equal(P.refreshIntervalSec(undefined), 30)
  })

  it('falls back to the default for null and an empty string', () => {
    assert.equal(P.refreshIntervalSec(null), 30)
    assert.equal(P.refreshIntervalSec(''), 30)
  })
})

const requestTo = (createdAt, requestedReviewer) => ({ createdAt, requestedReviewer })
const toMe = { isViewer: true }
const toTeam = (combinedSlug) => ({ combinedSlug })
const requestNode = (requests, overrides) => prNode(Object.assign({ timelineItems: { nodes: requests } }, overrides))
const reviewRequestedAt = (node, teams) => P.parseRun(0, response([], [node], teams), '', '').prsToReview[0].reviewRequestedAt

describe('parseRun review request', () => {
  it('is the latest Review request to the viewer', () => {
    const node = requestNode([requestTo('2026-10-01T10:00:00Z', toMe), requestTo('2026-10-05T10:00:00Z', toMe)])
    assert.equal(reviewRequestedAt(node), '2026-10-05T10:00:00Z')
  })

  it('counts a Review request to a team the viewer is in', () => {
    const node = requestNode([requestTo('2026-10-01T10:00:00Z', toMe), requestTo('2026-10-05T10:00:00Z', toTeam('acme/frontend'))])
    assert.equal(reviewRequestedAt(node, ['acme/frontend']), '2026-10-05T10:00:00Z')
  })

  it('ignores requests to other people and other teams', () => {
    const node = requestNode([
      requestTo('2026-10-01T10:00:00Z', toTeam('acme/frontend')),
      requestTo('2026-10-05T10:00:00Z', { isViewer: false }),
      requestTo('2026-10-05T11:00:00Z', {}),
      requestTo('2026-10-06T10:00:00Z', toTeam('acme/backend')),
      requestTo('2026-10-07T10:00:00Z', null)
    ])
    assert.equal(reviewRequestedAt(node, ['acme/frontend']), '2026-10-01T10:00:00Z')
  })

  it('falls back to the PR creation when no Review request is found', () => {
    const node = requestNode([requestTo('2026-10-05T10:00:00Z', toTeam('acme/backend'))], { createdAt: '2026-09-24T15:51:45Z' })
    assert.equal(reviewRequestedAt(node, ['acme/frontend']), '2026-09-24T15:51:45Z')
  })
})

describe('withoutStalePrs', () => {
  const now = Date.parse('2026-10-21T12:00:00Z')

  it('keeps a PR updated inside the max age', () => {
    const fresh = pr('passing', '2026-10-20T12:00:00Z')
    assert.deepEqual(P.withoutStalePrs([fresh], 7, now, 'updatedAt'), [fresh])
  })

  it('hides a PR updated before the max age', () => {
    assert.deepEqual(P.withoutStalePrs([pr('failing', '2026-10-01T12:00:00Z')], 7, now, 'updatedAt'), [])
  })

  it('treats the limit as inclusive', () => {
    const atLimit = pr('passing', '2026-10-14T12:00:00.000Z', 1)
    const pastLimit = pr('passing', '2026-10-14T11:59:59.999Z', 2)
    assert.deepEqual(P.withoutStalePrs([atLimit, pastLimit], 7, now, 'updatedAt'), [atLimit])
  })

  it('keeps an empty list empty', () => {
    assert.deepEqual(P.withoutStalePrs([], 7, now, 'updatedAt'), [])
  })

  it('can measure the age from the latest Review request', () => {
    const recentlyUpdated = Object.assign(pr('passing', '2026-10-20T12:00:00Z', 1), { reviewRequestedAt: '2026-09-24T12:00:00Z' })
    const recentlyRequested = Object.assign(pr('passing', '2026-10-20T12:00:00Z', 2), { reviewRequestedAt: '2026-10-20T12:00:00Z' })
    assert.deepEqual(P.withoutStalePrs([recentlyUpdated, recentlyRequested], 7, now, 'reviewRequestedAt'), [recentlyRequested])
  })
})

describe('refreshLabel', () => {
  const lastRefresh = Date.parse('2026-10-21T12:00:00Z')
  const after = (sec) => P.refreshLabel(lastRefresh, lastRefresh + sec * 1000)

  it('says just now under a minute', () => {
    assert.equal(after(0), 'Refreshed just now')
    assert.equal(after(59), 'Refreshed just now')
  })

  it('counts whole minutes under an hour', () => {
    assert.equal(after(60), 'Refreshed 1 min ago')
    assert.equal(after(59 * 60 + 59), 'Refreshed 59 min ago')
  })

  it('counts whole hours under a day', () => {
    assert.equal(after(60 * 60), 'Refreshed 1 h ago')
    assert.equal(after((23 * 60 + 59) * 60), 'Refreshed 23 h ago')
  })

  it('counts whole days from a day on', () => {
    assert.equal(after(24 * 60 * 60), 'Refreshed 1 d ago')
    assert.equal(after(3 * 24 * 60 * 60 + 5 * 60 * 60), 'Refreshed 3 d ago')
  })
})

describe('withoutMyApprovedPrs', () => {
  const reviewedBy = (number, ...reviews) => Object.assign(pr('passing', undefined, number),
    { latestReviews: reviews.map(([author, state]) => ({ id: author + number, state, author })) })

  it('hides a PR the viewer approved', () => {
    assert.deepEqual(P.withoutMyApprovedPrs([reviewedBy(1, ['me', 'APPROVED'])], 'me'), [])
  })

  it('hides a PR the viewer approved even when others requested changes', () => {
    assert.deepEqual(P.withoutMyApprovedPrs([reviewedBy(1, ['ana', 'CHANGES_REQUESTED'], ['me', 'APPROVED'])], 'me'), [])
  })

  it('keeps a PR only someone else approved', () => {
    const approvedByAna = reviewedBy(1, ['ana', 'APPROVED'])
    assert.deepEqual(P.withoutMyApprovedPrs([approvedByAna], 'me'), [approvedByAna])
  })

  it('keeps a PR where the viewer only commented', () => {
    const commented = reviewedBy(1, ['me', 'COMMENTED'])
    assert.deepEqual(P.withoutMyApprovedPrs([commented], 'me'), [commented])
  })

  it('keeps a PR whose Approval was dismissed', () => {
    const dismissed = reviewedBy(1, ['me', 'DISMISSED'])
    assert.deepEqual(P.withoutMyApprovedPrs([dismissed], 'me'), [dismissed])
  })

  it('keeps a PR where the viewer requested changes', () => {
    const changesRequested = reviewedBy(1, ['me', 'CHANGES_REQUESTED'])
    assert.deepEqual(P.withoutMyApprovedPrs([changesRequested], 'me'), [changesRequested])
  })

  it('keeps a PR with no Reviews', () => {
    const unreviewed = reviewedBy(1)
    assert.deepEqual(P.withoutMyApprovedPrs([unreviewed], 'me'), [unreviewed])
  })
})

describe('maxAgeDays', () => {
  it('keeps a value inside the range', () => {
    assert.equal(P.maxAgeDays(30), 30)
  })

  it('clamps to the allowed range', () => {
    assert.equal(P.maxAgeDays(0), 1)
    assert.equal(P.maxAgeDays(1000), 365)
  })

  it('rounds to whole days', () => {
    assert.equal(P.maxAgeDays(6.5), 7)
  })

  it('reads numeric strings', () => {
    assert.equal(P.maxAgeDays('14'), 14)
  })

  it('falls back to the default for a value that is not a number', () => {
    assert.equal(P.maxAgeDays('forever'), 365)
    assert.equal(P.maxAgeDays(undefined), 365)
  })

  it('falls back to the default for null and an empty string', () => {
    assert.equal(P.maxAgeDays(null), 365)
    assert.equal(P.maxAgeDays(''), 365)
  })
})

describe('parseAiCheckPatterns', () => {
  it('splits on commas and trims, keeping the case', () => {
    assert.deepEqual(P.parseAiCheckPatterns(' CodeRabbit ,Copilot'), ['CodeRabbit', 'Copilot'])
  })

  it('drops blank patterns and duplicates, ignoring case', () => {
    assert.deepEqual(P.parseAiCheckPatterns('CodeRabbit,, ,coderabbit'), ['CodeRabbit'])
  })

  it('is empty for an empty setting', () => {
    assert.deepEqual(P.parseAiCheckPatterns(''), [])
  })
})

describe('addAiCheckPatterns', () => {
  it('appends each comma-separated part', () => {
    assert.deepEqual(P.addAiCheckPatterns(['CodeRabbit'], 'foo, bar'), ['CodeRabbit', 'foo', 'bar'])
  })

  it('skips blank parts and patterns already in the list', () => {
    assert.deepEqual(P.addAiCheckPatterns(['CodeRabbit'], ' , CODERABBIT'), ['CodeRabbit'])
  })

  it('adds to an empty list', () => {
    assert.deepEqual(P.addAiCheckPatterns([], 'Copilot'), ['Copilot'])
  })
})

describe('joinAiCheckPatterns', () => {
  it('joins the patterns with a comma and a space', () => {
    assert.equal(P.joinAiCheckPatterns(['CodeRabbit', 'Copilot']), 'CodeRabbit, Copilot')
  })

  it('is empty for no patterns', () => {
    assert.equal(P.joinAiCheckPatterns([]), '')
  })

  it('round-trips through parseAiCheckPatterns', () => {
    assert.deepEqual(P.parseAiCheckPatterns(P.joinAiCheckPatterns(['a', 'b'])), ['a', 'b'])
  })
})

describe('removeAiCheckPattern', () => {
  it('removes only the given pattern', () => {
    assert.deepEqual(P.removeAiCheckPattern(['CodeRabbit', 'Copilot'], 'CodeRabbit'), ['Copilot'])
  })

  it('leaves an empty list after removing the last pattern', () => {
    assert.deepEqual(P.removeAiCheckPattern(['CodeRabbit'], 'CodeRabbit'), [])
  })
})

describe('settingOn', () => {
  it('is true when the key is missing', () => {
    assert.equal(P.settingOn({}, 'notifyCiPassed'), true)
  })

  it('is false only when the key is false', () => {
    assert.equal(P.settingOn({ notifyCiPassed: false }, 'notifyCiPassed'), false)
    assert.equal(P.settingOn({ notifyCiPassed: true }, 'notifyCiPassed'), true)
  })
})

describe('ciNotificationSetting', () => {
  it('matches the CI result', () => {
    assert.equal(P.ciNotificationSetting('passing'), 'notifyCiPassed')
    assert.equal(P.ciNotificationSetting('failing'), 'notifyCiFailed')
  })
})

describe('notificationEnabled', () => {
  it('is true when every key is missing', () => {
    assert.equal(P.notificationEnabled({}, 'notifyAiReviewDone'), true)
  })

  it('is false when the master switch is off, whatever the toggle says', () => {
    assert.equal(P.notificationEnabled({ notificationsEnabled: false, notifyCiPassed: true }, 'notifyCiPassed'), false)
  })

  it('is false when its own toggle is off', () => {
    for (const key of ['notifyAiReviewDone', 'notifyCiPassed', 'notifyCiFailed']) {
      assert.equal(P.notificationEnabled({ [key]: false }, key), false, key)
    }
  })

  it('ignores the other toggles', () => {
    assert.equal(P.notificationEnabled({ notifyCiPassed: false, notifyAiReviewDone: false }, 'notifyCiFailed'), true)
  })
})

const polled = (number, status, aiReviewDone, aiChangesSuggested = false) =>
  Object.assign(pr(status, undefined, number), { url: 'u' + number, aiReviewDone, aiChangesSuggested, latestReviews: [] })
const sent = (notifications) => notifications.map(n => [n.setting, n.title, n.pr.number])

describe('pollNotifications', () => {
  it('notifies AI changes suggested', () => {
    const notifications = P.pollNotifications([polled(1, 'none', false)], [polled(1, 'none', true, true)], null, 'me')
    assert.deepEqual(sent(notifications), [['notifyAiReviewDone', 'AI review: changes suggested', 1]])
  })

  it('notifies no AI changes suggested', () => {
    const notifications = P.pollNotifications([polled(1, 'none', false)], [polled(1, 'none', true)], null, 'me')
    assert.deepEqual(sent(notifications), [['notifyAiReviewDone', 'AI review: no changes suggested', 1]])
  })

  it('sends nothing for AI changes suggested later', () => {
    assert.deepEqual(P.pollNotifications([polled(1, 'none', true)], [polled(1, 'none', true, true)], null, 'me'), [])
  })

  it('notifies when CI passed or failed', () => {
    const previous = [polled(1, 'running', false), polled(2, 'running', false)]
    const current = [polled(1, 'passing', false), polled(2, 'failing', false)]
    assert.deepEqual(sent(P.pollNotifications(previous, current, null, 'me')), [
      ['notifyCiPassed', 'CI passed', 1],
      ['notifyCiFailed', 'CI failed', 2]
    ])
  })

  it('sends both when the AI review and CI finish in the same poll', () => {
    const notifications = P.pollNotifications([polled(1, 'running', false)], [polled(1, 'passing', true)], null, 'me')
    assert.deepEqual(sent(notifications), [
      ['notifyAiReviewDone', 'AI review: no changes suggested', 1],
      ['notifyCiPassed', 'CI passed', 1]
    ])
  })

  it('sends nothing on the first poll', () => {
    assert.deepEqual(P.pollNotifications(null, [polled(1, 'passing', true)], null, 'me'), [])
  })

  it('sends nothing for a PR seen for the first time', () => {
    assert.deepEqual(P.pollNotifications([polled(1, 'running', false)], [polled(2, 'passing', true)], null, 'me'), [])
  })
})

const review = (id, state, author = 'ana') => ({ id, state, author })
const withReviews = (reviews) => Object.assign(polled(1, 'none', false), { latestReviews: reviews })
const reviewNotifications = (before, now) => sent(P.pollNotifications([withReviews(before)], [withReviews(now)], null, 'me'))

describe('pollNotifications reviews', () => {
  it('notifies when a reviewer approves', () => {
    assert.deepEqual(reviewNotifications([], [review('R1', 'APPROVED')]), [['notifyApproved', 'Approved by ana', 1]])
  })

  it('notifies when a reviewer requests changes', () => {
    assert.deepEqual(reviewNotifications([], [review('R1', 'CHANGES_REQUESTED')]), [['notifyChangesRequested', 'Changes requested by ana', 1]])
  })

  it('skips reviews that only comment or were dismissed', () => {
    assert.deepEqual(reviewNotifications([], [review('R1', 'COMMENTED'), review('R2', 'DISMISSED', 'bob')]), [])
  })

  it('skips a review already seen in the last poll', () => {
    assert.deepEqual(reviewNotifications([review('R1', 'APPROVED')], [review('R1', 'APPROVED')]), [])
  })

  it('notifies again when the same reviewer approves again', () => {
    assert.deepEqual(reviewNotifications([review('R1', 'APPROVED')], [review('R2', 'APPROVED')]), [['notifyApproved', 'Approved by ana', 1]])
  })

  it('sends one notification per reviewer', () => {
    assert.deepEqual(reviewNotifications([], [review('R1', 'APPROVED'), review('R2', 'CHANGES_REQUESTED', 'bob')]), [
      ['notifyApproved', 'Approved by ana', 1],
      ['notifyChangesRequested', 'Changes requested by bob', 1]
    ])
  })

  it('sends nothing on the first poll', () => {
    assert.deepEqual(P.pollNotifications(null, [withReviews([review('R1', 'APPROVED')])], null, 'me'), [])
  })

  it('sends nothing for a PR seen for the first time', () => {
    const other = Object.assign(withReviews([]), { url: 'u2' })
    assert.deepEqual(P.pollNotifications([other], [withReviews([review('R1', 'APPROVED')])], null, 'me'), [])
  })
})

const withId = (number) => Object.assign(polled(number, 'none', false), { id: 'PR_' + number })

describe('prIdsNeedingDetails', () => {
  it('lists PRs missing from the current poll', () => {
    assert.deepEqual(P.prIdsNeedingDetails([withId(1), withId(2)], [withId(2)]), ['PR_1'])
  })

  it('skips unchanged and new PRs', () => {
    assert.deepEqual(P.prIdsNeedingDetails([withId(1)], [withId(1), withId(2)]), [])
  })

  it('is empty on the first poll', () => {
    assert.deepEqual(P.prIdsNeedingDetails(null, [withId(1)]), [])
  })

  it('lists PRs whose updatedAt changed', () => {
    const changed = Object.assign(withId(2), { updatedAt: '2026-10-20T10:00:00Z' })
    assert.deepEqual(P.prIdsNeedingDetails([withId(1), withId(2)], [changed]), ['PR_1', 'PR_2'])
  })
})

describe('detailsCommand', () => {
  it('passes each PR id as an item of the ids variable', () => {
    assert.deepEqual(P.detailsCommand(['PR_1', 'PR_2']),
      ['gh', 'api', 'graphql', '-f', 'query=' + P.DETAILS_QUERY, '-f', 'ids[]=PR_1', '-f', 'ids[]=PR_2'])
  })
})

const detailsNode = (state, mergedBy, closedBy, threads = []) => ({
  id: 'PR_1',
  state,
  mergedBy: mergedBy ? { login: mergedBy } : null,
  timelineItems: { nodes: closedBy ? [{ actor: { login: closedBy } }] : [] },
  reviewThreads: { nodes: threads }
})
const detailsResponse = (nodes) => JSON.stringify({ data: { nodes } })
const commentThread = (...comments) => ({ comments: { nodes: comments } })
const commentNode = (author, publishedAt) => ({ publishedAt, author: author ? { login: author } : null })

describe('parseDetailsRun', () => {
  it('reads who merged a merged PR', () => {
    assert.deepEqual(P.parseDetailsRun(0, detailsResponse([detailsNode('MERGED', 'alice', 'alice')]), ''),
      { details: [{ id: 'PR_1', state: 'MERGED', actor: 'alice', codeComments: [] }], error: '' })
  })

  it('reads the code comments of every review thread', () => {
    const threads = [commentThread(commentNode('ana', 'T1'), commentNode('me', 'T2')), commentThread(commentNode(null, 'T3'))]
    assert.deepEqual(P.parseDetailsRun(0, detailsResponse([detailsNode('OPEN', null, null, threads)]), '').details[0].codeComments, [
      { author: 'ana', publishedAt: 'T1' },
      { author: 'me', publishedAt: 'T2' },
      { author: 'ghost', publishedAt: 'T3' }
    ])
  })

  it('reads who closed a closed PR', () => {
    assert.equal(P.parseDetailsRun(0, detailsResponse([detailsNode('CLOSED', null, 'bob')]), '').details[0].actor, 'bob')
  })

  it('names a deleted merger ghost', () => {
    assert.equal(P.parseDetailsRun(0, detailsResponse([detailsNode('MERGED', null, null)]), '').details[0].actor, 'ghost')
  })

  it('names a deleted closer ghost', () => {
    const node = Object.assign(detailsNode('CLOSED', null, null), { timelineItems: { nodes: [{ actor: null }] } })
    assert.equal(P.parseDetailsRun(0, detailsResponse([node]), '').details[0].actor, 'ghost')
  })

  it('has no actor for an open PR that was never closed', () => {
    assert.equal(P.parseDetailsRun(0, detailsResponse([detailsNode('OPEN', null, null)]), '').details[0].actor, '')
  })

  it('reports a gh failure', () => {
    assert.deepEqual(P.parseDetailsRun(1, '', 'gh: Could not resolve to a node\n'),
      { details: [], error: 'gh: Could not resolve to a node' })
  })

  it('reports a broken response', () => {
    assert.equal(P.parseDetailsRun(0, '{"data":{}}', '').error, 'Unexpected response from gh')
  })
})

const details = (state, actor) => [{ id: 'PR_1', state, actor }]

describe('pollNotifications merged and closed', () => {
  it('notifies when someone else merged the PR', () => {
    const notifications = P.pollNotifications([withId(1)], [], details('MERGED', 'alice'), 'me')
    assert.deepEqual(sent(notifications), [['notifyMerged', 'PR merged by alice', 1]])
    assert.equal(notifications[0].pr.url, 'u1')
  })

  it('notifies when someone else closed the PR', () => {
    assert.deepEqual(sent(P.pollNotifications([withId(1)], [], details('CLOSED', 'bob'), 'me')),
      [['notifyClosed', 'PR closed by bob', 1]])
  })

  it('sends nothing when the viewer merged or closed the PR', () => {
    assert.deepEqual(P.pollNotifications([withId(1)], [], details('MERGED', 'me'), 'me'), [])
    assert.deepEqual(P.pollNotifications([withId(1)], [], details('CLOSED', 'me'), 'me'), [])
  })

  it('sends nothing for a missing PR that is still open', () => {
    assert.deepEqual(P.pollNotifications([withId(1)], [], details('OPEN', ''), 'me'), [])
  })

  it('keeps the other notifications when details failed', () => {
    const previous = [withId(1), Object.assign(withId(2), { status: 'running' })]
    const current = [Object.assign(withId(2), { status: 'passing' })]
    assert.deepEqual(sent(P.pollNotifications(previous, current, null, 'me')), [['notifyCiPassed', 'CI passed', 2]])
  })
})

const comment = (author, publishedAt = '2026-10-19T11:00:00Z') => ({ author, publishedAt })
const updated = () => Object.assign(withId(1), { updatedAt: '2026-10-19T12:00:00Z' })
const commentDetails = (codeComments) => [{ id: 'PR_1', state: 'OPEN', actor: '', codeComments }]
const commentNotifications = (codeComments) =>
  sent(P.pollNotifications([withId(1)], [updated()], commentDetails(codeComments), 'me'))

describe('pollNotifications code comments', () => {
  it('names the author of a single new comment', () => {
    assert.deepEqual(commentNotifications([comment('ana')]), [['notifyCodeComments', 'New code comment from ana', 1]])
  })

  it('counts many new comments in one notification', () => {
    assert.deepEqual(commentNotifications([comment('ana'), comment('bob'), comment('ana')]),
      [['notifyCodeComments', '3 new code comments', 1]])
  })

  it('skips the viewer\'s own comments', () => {
    assert.deepEqual(commentNotifications([comment('me'), comment('me')]), [])
    assert.deepEqual(commentNotifications([comment('me'), comment('ana')]), [['notifyCodeComments', 'New code comment from ana', 1]])
  })

  it('counts comments from bots', () => {
    assert.deepEqual(commentNotifications([comment('coderabbitai')]), [['notifyCodeComments', 'New code comment from coderabbitai', 1]])
  })

  it('counts a reply in a resolved thread', () => {
    const resolved = { isResolved: true, comments: { nodes: [commentNode('ana', '2026-10-19T09:00:00Z'), commentNode('bob', '2026-10-19T11:00:00Z')] } }
    const { details } = P.parseDetailsRun(0, detailsResponse([detailsNode('OPEN', null, null, [resolved])]), '')
    assert.deepEqual(sent(P.pollNotifications([withId(1)], [updated()], details, 'me')),
      [['notifyCodeComments', 'New code comment from bob', 1]])
  })

  it('skips comments published before the previous poll', () => {
    assert.deepEqual(commentNotifications([comment('ana', '2026-10-19T09:00:00Z'), comment('bob', '2026-10-19T10:00:00Z')]), [])
  })

  it('sends both the Review and the comments of the same poll', () => {
    const now = Object.assign(updated(), { latestReviews: [review('R1', 'APPROVED')] })
    assert.deepEqual(sent(P.pollNotifications([withId(1)], [now], commentDetails([comment('ana')]), 'me')), [
      ['notifyApproved', 'Approved by ana', 1],
      ['notifyCodeComments', 'New code comment from ana', 1]
    ])
  })

  it('sends nothing on the first poll', () => {
    assert.deepEqual(P.pollNotifications(null, [updated()], commentDetails([comment('ana')]), 'me'), [])
  })

  it('sends nothing for a PR seen for the first time', () => {
    assert.deepEqual(P.pollNotifications([withId(2)], [updated()], commentDetails([comment('ana')]), 'me'), [])
  })

  it('sends nothing when details failed', () => {
    assert.deepEqual(P.pollNotifications([withId(1)], [updated()], null, 'me'), [])
  })
})

describe('notificationEnabled activity toggles', () => {
  const keys = ['notifyApproved', 'notifyChangesRequested', 'notifyMerged', 'notifyClosed', 'notifyCodeComments']

  it('is on when the key is missing', () => {
    for (const key of keys) assert.equal(P.notificationEnabled({}, key), true, key)
  })

  it('is on when the master switch and its toggle are on', () => {
    for (const key of keys) assert.equal(P.notificationEnabled({ notificationsEnabled: true, [key]: true }, key), true, key)
  })

  it('is off when its own toggle is off', () => {
    for (const key of keys) assert.equal(P.notificationEnabled({ [key]: false }, key), false, key)
  })

  it('is off when the master switch is off', () => {
    for (const key of keys) assert.equal(P.notificationEnabled({ notificationsEnabled: false, [key]: true }, key), false, key)
  })
})
