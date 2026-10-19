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

  // nf-fa-github, the multiplication sign shown on error, and nf-md-robot.
  readonly property string iconGithub: ""
  readonly property string iconError: "✕"
  readonly property string iconAiReview: "󰚩"

  readonly property string fontFamily: bar ? bar.fontFamily : Style.font.family
  readonly property color foreground: bar ? bar.foreground : Commons.Color.foreground

  property var prs: []
  // PRs from the last successful poll; null until the first one.
  property var lastPrs: null
  property string error: ""
  property bool loaded: false
  property var colors: Prs.DEFAULT_COLORS

  readonly property var summary: Prs.barSummary(prs)
  readonly property var prSections: Prs.sections(prs)
  // An error shows as a red mark instead of a count.
  readonly property string badgeStatus: error !== "" ? "failing" : summary.status
  readonly property string badgeLabel: error !== "" ? iconError : String(summary.count)

  function colorFor(status) {
    return colors[status] || Commons.Color.muted
  }

  function refresh() {
    if (fetchProc.running) return
    themeFile.reload()
    fetchProc.running = true
  }

  // Sends a desktop notification about a PR; clicking it opens the PR.
  function notify(icon, title, pr) {
    Util.execArgv([
      "omarchy-notification-send", "--app-name", "GitHub PRs", "-g", icon,
      title, pr.repo + "#" + pr.number + " — " + pr.title,
      "--exec", "xdg-open", pr.url
    ])
  }

  onOpenedChanged: if (opened) refresh()

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
                                String(root.setting("aiCheckNames", "CodeRabbit")))
      if (result.error === "") {
        Prs.finishedAiReviews(root.lastPrs, result.prs).forEach(function(pr) {
          root.notify(root.iconAiReview, "AI review done", pr)
        })
        Prs.finishedCi(root.lastPrs, result.prs).forEach(function(pr) {
          root.notify(root.iconGithub, pr.status === "passing" ? "CI passed" : "CI failed", pr)
        })
        root.lastPrs = result.prs
      }
      root.prs = result.prs
      root.error = result.error
      root.loaded = true
    }
  }

  Timer {
    interval: Math.max(1, Number(root.setting("refreshIntervalSec", 10))) * 1000
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

  // A colored dot followed by a count, or by the error mark.
  component StatusBadge: Row {
    id: badge

    property string status: "none"
    property string label: ""
    property real size: Style.font.body

    spacing: Math.round(size * 0.35)

    StatusDot {
      anchors.verticalCenter: parent.verticalCenter
      status: badge.status
      size: Math.round(badge.size * 0.7)
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

  PopupCard {
    id: popup
    anchorItem: button
    owner: root
    bar: root.bar
    open: root.opened
    contentWidth: popup.fittedContentWidth(Style.space(420))
    contentHeight: popup.fittedContentHeight(header.implicitHeight + header.spacing + prList.implicitHeight, popup.screenH * 0.6)

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
          text: "Pull Requests"
          textFormat: Text.PlainText
          font.family: root.fontFamily
          font.pixelSize: Style.font.title
          font.bold: true
          color: root.foreground
        }

        StatusBadge {
          id: headerBadge
          anchors.right: parent.right
          anchors.verticalCenter: parent.verticalCenter
          visible: root.badgeStatus !== "none"
          status: root.badgeStatus
          label: root.badgeLabel
        }
      }

      PanelSeparator { width: parent.width }
    }

    Flickable {
      id: scroller
      anchors.top: header.bottom
      anchors.topMargin: header.spacing
      anchors.bottom: parent.bottom
      width: parent.width
      contentHeight: prList.implicitHeight
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

      Column {
        id: prList
        // Leaves room for the scrollbar when the list overflows.
        width: parent.width - (scroller.contentHeight > scroller.height ? Style.space(10) : 0)
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
          visible: root.loaded && root.error === "" && root.prs.length === 0
          text: "No open pull requests"
          textFormat: Text.PlainText
          font.family: root.fontFamily
          font.pixelSize: Style.font.body
          color: Commons.Color.muted
        }

        Repeater {
          model: root.error === "" ? root.prSections : []

          delegate: Column {
            id: section
            required property var modelData
            width: prList.width
            spacing: Style.space(4)

            Row {
              spacing: Style.space(6)

              StatusBadge {
                anchors.verticalCenter: parent.verticalCenter
                status: section.modelData.status
                label: String(section.modelData.prs.length)
                size: Style.font.caption
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

                  Text {
                    anchors.verticalCenter: parent.verticalCenter
                    visible: row.modelData.aiReviewDone
                    text: root.iconAiReview
                    textFormat: Text.PlainText
                    font.family: root.fontFamily
                    font.pixelSize: Style.font.bodySmall
                    color: root.foreground
                  }

                  Text {
                    anchors.verticalCenter: parent.verticalCenter
                    text: row.modelData.repo + "#" + row.modelData.number
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
    }
  }
}
