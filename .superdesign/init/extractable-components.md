# Extractable Components

## Sidebar
- Source: `client/src/components/sidebar/Sidebar.jsx`
- Category: layout
- Description: Research session context and retrieval stats with actions.
- Extractable props:
  - `sessionTitle` (string, default: "Untitled session")
  - `disease` (string, default: "N/A")
  - `intent` (string, default: "General")
  - `city` (string, default: "Unknown city")
  - `country` (string, default: "Unknown country")
  - `messageCount` (number, default: 0)
- Hardcoded: visual classes, button styles, section labels.

## ContextForm
- Source: `client/src/components/ContextForm.jsx`
- Category: basic
- Description: Modal form to initialize research context.
- Extractable props:
  - `disease` (string, default: "")
  - `intent` (string, default: "")
  - `city` (string, default: "")
  - `country` (string, default: "")
  - `age` (number, default: 0)
  - `sex` (string, default: "")
- Hardcoded: labels, suggestions, style classes.

## ExportButton
- Source: `client/src/components/sidebar/ExportButton.jsx`
- Category: basic
- Description: Exports a PDF research brief for the current session.
- Extractable props:
  - `label` (string, default: "Export research brief")
  - `disabled` (boolean, default: false)
- Hardcoded: icon, color, export action style.
