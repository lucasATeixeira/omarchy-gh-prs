'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { loadQmlLibrary } = require('./load.js')

const P = loadQmlLibrary('js/prs.js')

const run = (status, conclusion, name = 'tests') => ({ __typename: 'CheckRun', name, status, conclusion })
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
  number: 7,
  title: 'Add widget',
  url: 'https://github.com/acme/app/pull/7',
  isDraft: false,
  updatedAt: '2026-10-19T10:00:00Z',
  reviewDecision: 'APPROVED',
  reviewThreads: { nodes: [] },
  latestReviews: { nodes: [] },
  mergeable: 'MERGEABLE',
  repository: { nameWithOwner: 'acme/app' },
  commits: { nodes: [{ commit: { statusCheckRollup: { contexts: { nodes: [run('COMPLETED', 'FAILURE')] } } } }] }
}, overrides)

const response = (nodes) => JSON.stringify({ data: { search: { nodes } } })

describe('parseRun success', () => {
  it('turns search results into pull requests with their CI status', () => {
    assert.deepEqual(P.parseRun(0, response([prNode()]), '', ''), {
      prs: [{
        repo: 'acme/app',
        number: 7,
        title: 'Add widget',
        url: 'https://github.com/acme/app/pull/7',
        isDraft: false,
        updatedAt: '2026-10-19T10:00:00Z',
        status: 'failing',
        aiReviewDone: false,
        reviewDecision: 'APPROVED',
        unresolvedThreadCount: 0,
        hasConflict: false,
        latestReviews: []
      }],
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

const thread = (isResolved) => ({ isResolved })
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
  it('reads the review decision', () => {
    assert.match(P.QUERY, /\breviewDecision\b/)
  })

  it('reads whether each review thread is resolved', () => {
    assert.match(P.QUERY, /reviewThreads\(first: 100\)[^}]*\bisResolved\b/)
  })

  it('reads each reviewer\'s latest review', () => {
    assert.match(P.QUERY, /latestReviews\(first: 20\) \{ nodes \{ id state author \{ login \} \} \}/)
  })

  it('reads whether the PR can merge', () => {
    assert.match(P.QUERY, /\bmergeable\b/)
  })
})

describe('parseRun exit codes', () => {
  it('parses stdout when gh succeeds', () => {
    assert.equal(P.parseRun(0, response([prNode()]), '', '').prs[0].status, 'failing')
  })

  it('drops the PR list and reports the error when gh fails', () => {
    assert.deepEqual(P.parseRun(1, '', 'gh: Something went wrong\n'), { prs: [], error: 'gh: Something went wrong' })
  })
})

describe('refreshIntervalSec', () => {
  it('keeps a value inside the range', () => {
    assert.equal(P.refreshIntervalSec(30), 30)
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
    assert.equal(P.refreshIntervalSec('soon'), 10)
    assert.equal(P.refreshIntervalSec(undefined), 10)
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

  it('treats the review toggles like the others', () => {
    for (const key of ['notifyApproved', 'notifyChangesRequested']) {
      assert.equal(P.notificationEnabled({}, key), true, key)
      assert.equal(P.notificationEnabled({ [key]: false }, key), false, key)
      assert.equal(P.notificationEnabled({ notificationsEnabled: false }, key), false, key)
    }
  })

  it('ignores the other toggles', () => {
    assert.equal(P.notificationEnabled({ notifyCiPassed: false, notifyAiReviewDone: false }, 'notifyCiFailed'), true)
  })
})

const polled = (number, status, aiReviewDone) => Object.assign(pr(status, undefined, number), { url: 'u' + number, aiReviewDone, latestReviews: [] })
const sent = (notifications) => notifications.map(n => [n.setting, n.title, n.pr.number])

describe('pollNotifications', () => {
  it('notifies when the AI review is done', () => {
    const notifications = P.pollNotifications([polled(1, 'none', false)], [polled(1, 'none', true)], null, 'me')
    assert.deepEqual(sent(notifications), [['notifyAiReviewDone', 'AI review done', 1]])
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
    assert.deepEqual(sent(notifications), [['notifyAiReviewDone', 'AI review done', 1], ['notifyCiPassed', 'CI passed', 1]])
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
