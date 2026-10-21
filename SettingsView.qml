import QtQuick
import qs.Commons
import qs.Commons as Commons
import qs.Ui
import "js/prs.js" as Prs

// Settings page of the popup; every change is saved through `panel.saveSettings` right away.
FocusScope {
  id: root

  required property Item panel

  readonly property var aiCheckPatterns: Prs.parseAiCheckPatterns(panel.aiCheckNames)

  function addPatterns() {
    panel.saveAiCheckPatterns(Prs.addAiCheckPatterns(aiCheckPatterns, patternField.text))
    patternField.text = ""
  }

  implicitHeight: content.implicitHeight

  // Shows and flips one boolean setting.
  component SettingToggle: Toggle {
    property string key: ""

    width: parent.width
    checked: Prs.settingOn(root.panel.settings, key)
    foreground: root.panel.foreground
    fontFamily: root.panel.fontFamily
    onClicked: root.panel.saveSettings({ [key]: !checked })
  }

  Column {
    id: content
    width: parent.width
    spacing: Style.space(14)

    Column {
      width: parent.width
      spacing: Style.space(6)

      PanelSectionHeader { text: "Refresh"; foreground: root.panel.foreground }

      NumberField {
        label: "Seconds between GitHub queries"
        from: Prs.REFRESH_INTERVAL_MIN_SEC
        to: Prs.REFRESH_INTERVAL_MAX_SEC
        stepSize: 5
        value: root.panel.refreshIntervalSec
        foreground: root.panel.foreground
        fontFamily: root.panel.fontFamily
        onModified: function(value) { root.panel.saveSettings({ refreshIntervalSec: value }) }
      }
    }

    Column {
      width: parent.width
      spacing: Style.space(6)

      PanelSectionHeader { text: "Hide stale PRs"; foreground: root.panel.foreground }

      NumberField {
        label: "Authored: max days since last update"
        from: Prs.MAX_AGE_MIN_DAYS
        to: Prs.MAX_AGE_MAX_DAYS
        stepSize: 1
        value: root.panel.authoredMaxAgeDays
        foreground: root.panel.foreground
        fontFamily: root.panel.fontFamily
        onModified: function(value) { root.panel.saveSettings({ authoredMaxAgeDays: value }) }
      }
    }

    Column {
      width: parent.width
      spacing: Style.space(6)

      PanelSectionHeader { text: "AI check patterns"; foreground: root.panel.foreground }

      Text {
        width: parent.width
        text: "A check whose name contains one of these, ignoring case, is an AI review."
        textFormat: Text.PlainText
        wrapMode: Text.Wrap
        font.family: root.panel.fontFamily
        font.pixelSize: Style.font.caption
        color: Commons.Color.muted
      }

      Repeater {
        model: root.aiCheckPatterns

        delegate: Item {
          id: patternRow
          required property string modelData
          width: parent.width
          height: removeButton.height

          Text {
            anchors.left: parent.left
            anchors.right: removeButton.left
            anchors.verticalCenter: parent.verticalCenter
            text: patternRow.modelData
            textFormat: Text.PlainText
            elide: Text.ElideRight
            font.family: root.panel.fontFamily
            font.pixelSize: Style.font.body
            color: root.panel.foreground
          }

          PanelActionButton {
            id: removeButton
            anchors.right: parent.right
            iconText: "✕"
            tooltipText: "Remove"
            foreground: root.panel.foreground
            fontFamily: root.panel.fontFamily
            onClicked: root.panel.saveAiCheckPatterns(Prs.removeAiCheckPattern(root.aiCheckPatterns, patternRow.modelData))
          }
        }
      }

      Text {
        visible: root.aiCheckPatterns.length === 0
        width: parent.width
        text: "No AI check patterns. The robot icon and AI review notifications are off."
        textFormat: Text.PlainText
        wrapMode: Text.Wrap
        font.family: root.panel.fontFamily
        font.pixelSize: Style.font.bodySmall
        color: Commons.Color.muted
      }

      Row {
        width: parent.width
        spacing: Style.space(6)

        TextField {
          id: patternField
          width: parent.width - addButton.width - parent.spacing
          placeholderText: "e.g. CodeRabbit, Copilot"
          foreground: root.panel.foreground
          onAccepted: root.addPatterns()
        }

        Button {
          id: addButton
          anchors.verticalCenter: parent.verticalCenter
          text: "Add"
          bordered: true
          foreground: root.panel.foreground
          enabled: patternField.text.trim() !== ""
          onClicked: root.addPatterns()
        }
      }
    }

    Column {
      width: parent.width
      spacing: Style.space(6)

      PanelSectionHeader { text: "Notifications"; foreground: root.panel.foreground }

      SettingToggle {
        key: "notificationsEnabled"
        label: "All notifications"
        description: "Turn off to stop every notification. The choices below are kept."
      }

      Column {
        x: Style.space(16)
        width: parent.width - x
        spacing: Style.space(6)
        enabled: Prs.settingOn(root.panel.settings, "notificationsEnabled")
        opacity: enabled ? 1 : 0.5

        SettingToggle { key: "notifyAiReviewDone"; label: "AI review done" }
        SettingToggle { key: "notifyCiPassed"; label: "CI passed" }
        SettingToggle { key: "notifyCiFailed"; label: "CI failed" }
        SettingToggle { key: "notifyApproved"; label: "PR approved" }
        SettingToggle { key: "notifyChangesRequested"; label: "Changes requested" }
        SettingToggle { key: "notifyCodeComments"; label: "New code comments" }
        SettingToggle { key: "notifyMerged"; label: "PR merged" }
        SettingToggle { key: "notifyClosed"; label: "PR closed" }
      }
    }
  }
}
