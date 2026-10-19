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
        reviewDecision: 'APPROVED'
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

describe('QUERY', () => {
  it('reads the review decision', () => {
    assert.match(P.QUERY, /\breviewDecision\b/)
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
