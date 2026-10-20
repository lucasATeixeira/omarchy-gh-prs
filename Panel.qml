import QtQuick
import QtQuick.Controls
import Quickshell.Io
import qs.Commons
import qs.Commons as Commons
import qs.Ui
import "js/prs.js" as Prs

// Bar widget for your open GitHub PRs: the bar shows the worst CI status and
// how many PRs share it, and the popup lists every PR grouped by status.
Panel {
  id: root

  moduleName: "lucas.gh-prs"
  ipcTarget: "lucas.gh-prs"

  readonly property string iconGithub: "" // nf-fa-github
  readonly property string iconError: "✕"
  readonly property string iconAiReview: "󰚩" // nf-md-robot
  readonly property string iconApproved: "󰗠" // nf-md-check_circle
  readonly property string iconChangesRequested: "󰷈" // nf-md-file_document_edit
  readonly property string iconUnresolvedThreads: "󰆂" // nf-md-comment_outline
  readonly property string iconConflict: "󰀦" // nf-md-alert
  readonly property string iconSettings: "󰒓" // nf-md-cog
  readonly property string iconBack: "󰁍" // nf-md-arrow_left
  readonly property string iconMerged: "󰘭" // nf-md-source_merge
  readonly property string iconClosed: "󰅙" // nf-md-close_circle
  // Approved has no icon here because the approval count shows it.
  readonly property var reviewDecisionIcons: ({ CHANGES_REQUESTED: iconChangesRequested })
  // A notification setting missing here uses the GitHub icon.
  readonly property var notificationIcons: ({
    notifyAiReviewDone: iconAiReview, notifyApproved: iconApproved, notifyChangesRequested: iconChangesRequested,
    notifyCodeComments: iconUnresolvedThreads, notifyMerged: iconMerged, notifyClosed: iconClosed
  })

  readonly property string fontFamily: bar ? bar.fontFamily : Style.font.family
  readonly property color foreground: bar ? bar.foreground : Commons.Color.foreground

  property var prs: []
  property var prsToReview: []
  // PRs from the last successful poll; null until the first one.
  property var lastPrs: null
  // The successful main poll that waits for its details query.
  property var pendingPoll: null
  property string error: ""
  property bool loaded: false
  property var colors: Prs.DEFAULT_COLORS
  property bool settingsOpen: false
  property int tabIndex: 0

  readonly property string aiCheckNames: String(setting("aiCheckNames", "CodeRabbit"))
  readonly property int refreshIntervalSec: Prs.refreshIntervalSec(setting("refreshIntervalSec", 10))

  readonly property var summary: Prs.barSummary(prs)
  // An error shows as a red mark instead of a count.
  readonly property string badgeStatus: error !== "" ? "failing" : summary.status
  readonly property string badgeLabel: error !== "" ? iconError : String(summary.count)
  readonly property var tabs: Prs.tabs(prs, prsToReview, loaded && error === "")
  readonly property var currentTab: tabs[tabIndex]

  function colorFor(status) {
    return colors[status] || Commons.Color.muted
  }

  // Empty when the review decision has no icon.
  function reviewDecisionIcon(decision) {
    return reviewDecisionIcons[decision] || ""
  }

  function refresh() {
    if (fetchProc.running || detailsProc.running) return
    themeFile.reload()
    fetchProc.running = true
  }

  // Saves the overrides to this widget's entry in shell.json and applies them right away.
  function saveSettings(overrides) {
    root.settings = Object.assign({}, root.settings, overrides)
    if (bar) bar.shell.updateEntryInline(root.moduleName, root.settings)
  }

  // Polls right away and forgets the last seen PRs and any pending poll, so newly matched AI Checks do not all notify at once.
  function saveAiCheckPatterns(patterns) {
    var aiCheckNames = Prs.joinAiCheckPatterns(patterns)
    if (aiCheckNames === Prs.joinAiCheckPatterns(Prs.parseAiCheckPatterns(root.aiCheckNames))) return
    saveSettings({ aiCheckNames: aiCheckNames })
    root.lastPrs = null
    root.pendingPoll = null
    refresh()
  }

  // Selects the Tab at the index, kept within the Tabs.
  function selectTab(index) {
    tabIndex = Math.max(0, Math.min(tabs.length - 1, index))
    scroller.contentY = 0
  }

  function openSettings() {
    settingsOpen = true
    scroller.contentY = 0
  }

  function closeSettings() {
    settingsOpen = false
    scroller.contentY = 0
    keyCatcher.forceActiveFocus()
  }

  // Sends a desktop notification when its setting allows it; clicking it opens the PR.
  function notify(notification) {
    if (!Prs.notificationEnabled(root.settings, notification.setting)) return
    var pr = notification.pr
    Util.execArgv([
      "omarchy-notification-send", "--app-name", "GitHub PRs",
      "-g", root.notificationIcons[notification.setting] || root.iconGithub,
      notification.title, pr.repo + "#" + pr.number + " — " + pr.title,
      "--exec", "xdg-open", pr.url
    ])
  }

  // Sends the poll's notifications and keeps its PRs for the next poll.
  function finishPoll(poll, details) {
    Prs.pollNotifications(root.lastPrs, poll.prs, details, poll.viewerLogin).forEach(root.notify)
    root.lastPrs = poll.prs
  }

  onOpenedChanged: opened ? refresh() : closeSettings()

  FileView {
    id: themeFile
    path: Commons.Color.currentThemePath + "/colors.toml"
    printErrors: false
    onLoaded: root.colors = Prs.themeColors(text())
  }

  Process {
    id: fetchProc
    command: ["gh", "api", "graphql", "-f", "query=" + Prs.QUERY]
    stdout: StdioCollector { id: fetchStdout; waitForEnd: true }
    stderr: StdioCollector { id: fetchStderr; waitForEnd: true }
    onExited: function(exitCode) {
      var result = Prs.parseRun(exitCode, String(fetchStdout.text), String(fetchStderr.text),
                                root.aiCheckNames)
      if (result.error === "") {
        var ids = Prs.prIdsNeedingDetails(root.lastPrs, result.prs)
        if (ids.length > 0) {
          root.pendingPoll = result
          detailsProc.command = Prs.detailsCommand(ids)
          detailsProc.running = true
        } else {
          root.finishPoll(result, null)
        }
      }
      root.prs = result.prs
      root.prsToReview = result.prsToReview
      root.error = result.error
      root.loaded = true
    }
  }

  Process {
    id: detailsProc
    stdout: StdioCollector { id: detailsStdout; waitForEnd: true }
    stderr: StdioCollector { id: detailsStderr; waitForEnd: true }
    onExited: function(exitCode) {
      var result = Prs.parseDetailsRun(exitCode, String(detailsStdout.text), String(detailsStderr.text))
      // A pending poll cleared by a pattern change is dropped.
      if (root.pendingPoll) root.finishPoll(root.pendingPoll, result.error === "" ? result.details : null)
      root.pendingPoll = null
    }
  }

  Timer {
    interval: root.refreshIntervalSec * 1000
    running: true
    repeat: true
    triggeredOnStart: true
    onTriggered: root.refresh()
  }

  component StatusDot: Rectangle {
    property string status: "none"
    property real size: Math.round(Style.font.body * 0.7)

    width: size
    height: size
    radius: size / 2
    color: root.colorFor(status)
  }

  // A small icon in a PR row.
  component RowIcon: Text {
    anchors.verticalCenter: parent.verticalCenter
    textFormat: Text.PlainText
    font.family: root.fontFamily
    font.pixelSize: Style.font.caption
    color: root.foreground
  }

  // A colored dot followed by a count, or by the error mark.
  component StatusBadge: Row {
    id: badge

    property string status: "none"
    property string label: ""
    property real size: Style.font.body
    property real dotSize: Math.round(size * 0.7)

    spacing: Math.round(size * 0.35)

    StatusDot {
      anchors.verticalCenter: parent.verticalCenter
      status: badge.status
      size: badge.dotSize
    }

    Text {
      anchors.verticalCenter: parent.verticalCenter
      text: badge.label
      textFormat: Text.PlainText
      font.family: root.fontFamily
      font.pixelSize: badge.size
      font.bold: true
      color: root.colorFor(badge.status)
    }
  }

  // The error, the empty text, and the Sections of one list of PRs.
  component PrList: Column {
    id: list

    property var prs: []
    property string emptyText: ""
    property bool showAuthor: false
    readonly property var prSections: Prs.sections(prs)

    spacing: Style.space(10)

    Text {
      visible: root.error !== ""
      width: parent.width
      text: root.error
      textFormat: Text.PlainText
      wrapMode: Text.Wrap
      font.family: root.fontFamily
      font.pixelSize: Style.font.body
      color: root.colorFor("failing")
    }

    Text {
      visible: root.loaded && root.error === "" && list.prs.length === 0
      text: list.emptyText
      textFormat: Text.PlainText
      font.family: root.fontFamily
      font.pixelSize: Style.font.body
      color: Commons.Color.muted
    }

    Repeater {
      model: root.error === "" ? list.prSections : []

      delegate: Column {
        id: section
        required property var modelData
        width: list.width
        spacing: Style.space(4)

        Row {
          spacing: Style.space(6)

          StatusBadge {
            anchors.verticalCenter: parent.verticalCenter
            status: section.modelData.status
            label: String(section.modelData.prs.length)
            size: Style.font.caption
            // Larger than the row dot, so a Section stands out from its PRs.
            dotSize: Math.round(Style.font.caption * 0.8)
          }

          PanelSectionHeader {
            anchors.verticalCenter: parent.verticalCenter
            text: section.modelData.title
            foreground: root.foreground
          }
        }

        Repeater {
          model: section.modelData.prs

          delegate: Rectangle {
            id: row
            required property var modelData
            width: section.width
            height: rowContent.implicitHeight + Style.space(8)
            radius: Style.space(4)
            color: rowMouse.containsMouse ? Style.hoverFillFor(root.foreground) : "transparent"

            Row {
              id: rowContent
              anchors.left: parent.left
              anchors.right: parent.right
              anchors.leftMargin: Style.space(4)
              anchors.rightMargin: Style.space(4)
              anchors.verticalCenter: parent.verticalCenter
              spacing: Style.space(8)

              StatusDot {
                anchors.verticalCenter: parent.verticalCenter
                status: row.modelData.status
                size: Math.round(Style.font.caption * 0.5)
              }

              RowIcon {
                visible: row.modelData.aiReviewDone
                text: root.iconAiReview
              }

              RowIcon {
                visible: row.modelData.approvalCount > 0
                text: root.iconApproved + " " + row.modelData.approvalCount
              }

              RowIcon {
                visible: text !== ""
                text: root.reviewDecisionIcon(row.modelData.reviewDecision)
              }

              RowIcon {
                visible: row.modelData.unresolvedThreadCount > 0
                text: root.iconUnresolvedThreads + " " + row.modelData.unresolvedThreadCount
              }

              RowIcon {
                visible: row.modelData.hasConflict
                text: root.iconConflict
              }

              Text {
                anchors.verticalCenter: parent.verticalCenter
                text: row.modelData.repo + "#" + row.modelData.number + (list.showAuthor ? " @" + row.modelData.author : "")
                textFormat: Text.PlainText
                font.family: root.fontFamily
                font.pixelSize: Style.font.bodySmall
                color: Commons.Color.muted
              }

              Text {
                anchors.verticalCenter: parent.verticalCenter
                width: rowContent.width - x - (draftLabel.visible ? draftLabel.width + rowContent.spacing : 0)
                text: row.modelData.title
                textFormat: Text.PlainText
                elide: Text.ElideRight
                font.family: root.fontFamily
                font.pixelSize: Style.font.body
                color: root.foreground
              }

              Text {
                id: draftLabel
                anchors.verticalCenter: parent.verticalCenter
                visible: row.modelData.isDraft
                text: "draft"
                textFormat: Text.PlainText
                font.family: root.fontFamily
                font.pixelSize: Style.font.caption
                font.italic: true
                color: Commons.Color.muted
              }
            }

            MouseArea {
              id: rowMouse
              anchors.fill: parent
              hoverEnabled: true
              cursorShape: Qt.PointingHandCursor
              onClicked: {
                Qt.openUrlExternally(row.modelData.url)
                root.close()
              }
            }
          }
        }
      }
    }
  }

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  BarIconButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    tooltipText: ""
    hasVisualContent: true

    Item {
      anchors.fill: parent

      Text {
        id: githubIcon
        anchors.centerIn: parent
        text: root.iconGithub
        textFormat: Text.PlainText
        font.family: root.fontFamily
        font.pixelSize: Style.bar.iconFont
        color: root.barForeground
      }

      // The count sits on the icon's top-right corner and scales with the icon font.
      Rectangle {
        id: barBadge
        anchors.horizontalCenter: githubIcon.horizontalCenter
        anchors.horizontalCenterOffset: Math.round(Style.bar.iconFont * 0.42)
        anchors.verticalCenter: githubIcon.verticalCenter
        anchors.verticalCenterOffset: -Math.round(Style.bar.iconFont * 0.40)
        visible: root.badgeStatus !== "none"
        height: Math.round(Style.bar.iconFont * 0.95)
        width: Math.max(height, barCount.implicitWidth + Math.round(height * 0.45))
        radius: height / 2
        color: root.colorFor(root.badgeStatus)
        // A rim in the bar color keeps the badge apart from the icon under it.
        border.width: Math.round(Style.bar.iconFont * 0.06)
        border.color: Commons.Color.bar.background

        // Centers the glyph's ink, not its line box, so digits sit in the middle of the disc.
        TextMetrics {
          id: barCountInk
          font: barCount.font
          text: barCount.text
        }

        Text {
          id: barCount
          x: (barBadge.width - barCountInk.tightBoundingRect.width) / 2 - barCountInk.tightBoundingRect.x
          y: (barBadge.height - barCountInk.tightBoundingRect.height) / 2 - barCountInk.tightBoundingRect.y - baselineOffset
          text: root.badgeLabel
          textFormat: Text.PlainText
          font.family: root.fontFamily
          font.pixelSize: Math.round((barBadge.height - 2 * barBadge.border.width) * 0.88)
          font.bold: true
          color: Commons.Color.background
        }
      }
    }

    onPressed: root.toggle()
  }

  KeyboardPanel {
    id: popup
    anchorItem: button
    owner: root
    bar: root.bar
    open: root.opened
    focusTarget: keyCatcher
    contentWidth: popup.fittedContentWidth(Style.space(420))
    contentHeight: popup.fittedContentHeight(header.implicitHeight + header.spacing + scroller.contentHeight, popup.screenH * 0.6)

    PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent
      onCloseRequested: root.settingsOpen ? root.closeSettings() : root.close()
      onTabRequested: function(direction) { if (!root.settingsOpen) root.switchPanel(direction) }
      // h/l and Left/Right select the next Tab on that side.
      onMoveRequested: function(dx, dy) {
        if (!root.settingsOpen && dx !== 0) root.selectTab(root.tabIndex + dx)
      }

      Column {
        id: header
        width: parent.width
        spacing: Style.space(10)

        Item {
          width: parent.width
          height: Math.max(headerTitle.implicitHeight, headerBadge.implicitHeight)

          Text {
            id: headerTitle
            anchors.left: parent.left
            anchors.verticalCenter: parent.verticalCenter
            text: root.settingsOpen ? "Settings" : "Pull Requests"
            textFormat: Text.PlainText
            font.family: root.fontFamily
            font.pixelSize: Style.font.title
            font.bold: true
            color: root.foreground
          }

          Row {
            anchors.right: parent.right
            anchors.verticalCenter: parent.verticalCenter
            spacing: Style.space(8)

            StatusBadge {
              id: headerBadge
              anchors.verticalCenter: parent.verticalCenter
              visible: root.badgeStatus !== "none"
              status: root.badgeStatus
              label: root.badgeLabel
            }

            PanelActionButton {
              anchors.verticalCenter: parent.verticalCenter
              iconText: root.settingsOpen ? root.iconBack : root.iconSettings
              tooltipText: root.settingsOpen ? "Back" : "Settings"
              foreground: root.foreground
              fontFamily: root.fontFamily
              onClicked: root.settingsOpen ? root.closeSettings() : root.openSettings()
            }
          }
        }

        ButtonGroup {
          visible: !root.settingsOpen
          options: root.tabs.map(function(tab) { return { value: tab.name, label: tab.label } })
          value: root.currentTab.name
          focusable: false
          foreground: root.foreground
          fontFamily: root.fontFamily
          onChanged: function(value) { root.selectTab(root.tabs.findIndex(function(tab) { return tab.name === value })) }
        }

        PanelSeparator { width: parent.width }
      }

      Flickable {
        id: scroller
        anchors.top: header.bottom
        anchors.topMargin: header.spacing
        anchors.bottom: parent.bottom
        width: parent.width
        contentHeight: root.settingsOpen ? settingsView.implicitHeight : prList.implicitHeight
        // Leaves room for the scrollbar when the content overflows.
        readonly property real pageWidth: width - (contentHeight > height ? Style.space(10) : 0)
        boundsBehavior: Flickable.StopAtBounds
        clip: true

        ScrollBar.vertical: ScrollBar {
          policy: ScrollBar.AsNeeded
          // A custom handle loses the style's auto-hide, so hide it while the list fits.
          visible: size < 1.0
          contentItem: Rectangle {
            implicitWidth: Style.space(3)
            radius: width / 2
            color: Util.alpha(root.foreground, 0.3)
          }
        }

        SettingsView {
          id: settingsView
          visible: root.settingsOpen
          width: scroller.pageWidth
          panel: root
        }

        PrList {
          id: prList
          visible: !root.settingsOpen
          width: scroller.pageWidth
          prs: root.currentTab.prs
          emptyText: root.currentTab.emptyText
          showAuthor: root.currentTab.showAuthor
        }
      }
    }
  }
}
