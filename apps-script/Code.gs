/** @OnlyCurrentDoc */
// Q-Pass: the bridge between the app and this Google Sheet.
// @OnlyCurrentDoc above limits the script to this one spreadsheet, not all of yours.
// Paste into the Sheet (Extensions > Apps Script), set the SECRET script property, deploy as a web app.
// See README "One-time setup".

function doPost(e) {
  let out
  try {
    const req = JSON.parse(e.postData.contents)
    const secret = PropertiesService.getScriptProperties().getProperty('SECRET')
    if (!secret || req.secret !== secret) throw new Error('Wrong secret: APPS_SCRIPT_SECRET must match the SECRET script property')
    const op = OPS[req.op]
    if (!op) throw new Error('Unknown operation ' + req.op)
    out = { ok: true, data: op(req.args || {}) }
  } catch (err) {
    out = { ok: false, error: String((err && err.message) || err) }
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON)
}

const ss = () => SpreadsheetApp.getActive()

const trimRows = (rows) => {
  let n = rows.length
  while (n && rows[n - 1].every((c) => c === '')) n--
  return rows.slice(0, n)
}
const read = (range) => trimRows(ss().getRange(range).getDisplayValues())

const ensureRows = (sh, lastRow) => {
  if (sh.getMaxRows() < lastRow) sh.insertRowsAfter(sh.getMaxRows(), lastRow - sh.getMaxRows())
}

// Everything is stored as plain text so "0001" keeps its zeros and timestamps aren't reformatted.
const writeAt = (sh, row, col, values) => {
  ensureRows(sh, row + values.length - 1)
  sh.getRange(row, col, values.length, values[0].length).setNumberFormat('@').setValues(values)
}

const appendTo = (sheetName, values) => {
  const sh = ss().getSheetByName(sheetName)
  if (!sh) throw new Error('Missing tab ' + sheetName)
  writeAt(sh, sh.getLastRow() + 1, 1, values)
}

const pad = (v) => {
  const s = String(v).trim()
  return /^\d{1,4}$/.test(s) ? s.padStart(4, '0') : s
}

const OPS = {
  titles: () => ss().getSheets().map((s) => s.getName()),

  read: ({ range }) => read(range),

  readMany: ({ ranges }) => ranges.map(read),

  write: ({ range, values }) => {
    const r = ss().getRange(range)
    writeAt(r.getSheet(), r.getRow(), r.getColumn(), values)
    return null
  },

  append: ({ sheet, values }) => {
    appendTo(sheet, values)
    return null
  },

  // Removes an event for good: its row on Events, its ticket tab, and its rows on Log.
  deleteEvent: ({ name }) => {
    const lock = LockService.getScriptLock()
    lock.waitLock(20000)
    try {
      const events = ss().getSheetByName('Events')
      const names = events.getRange(2, 1, Math.max(events.getLastRow() - 1, 1), 1).getDisplayValues()
      for (let i = names.length - 1; i >= 0; i--) if (names[i][0] === name) events.deleteRow(i + 2)
      const tab = ss().getSheetByName(name)
      if (tab) ss().deleteSheet(tab)
      const log = ss().getSheetByName('Log')
      if (log && log.getLastRow() > 1) {
        const width = log.getLastColumn()
        const rows = log.getRange(2, 1, log.getLastRow() - 1, width).getDisplayValues()
        const keep = rows.filter((r) => r[1] !== name) // column B is the event
        if (keep.length !== rows.length) {
          log.getRange(2, 1, rows.length, width).clearContent()
          if (keep.length) log.getRange(2, 1, keep.length, width).setNumberFormat('@').setValues(keep)
        }
      }
    } finally {
      lock.releaseLock()
    }
    return null
  },

  addSheet: ({ title, headers, rowCount }) => {
    const sh = ss().insertSheet(title)
    ensureRows(sh, rowCount)
    writeAt(sh, 1, 1, [headers])
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold')
    sh.setFrozenRows(1)
    return null
  },

  // One locked step: find the ticket, mark it checked in if it isn't yet, and log the attempt.
  // Returns the ticket row as it was BEFORE this scan (or null if not found).
  checkIn: ({ event, ticket, now, staffName, staffRole, method }) => {
    const lock = LockService.getScriptLock()
    lock.waitLock(10000)
    try {
      const sh = ss().getSheetByName(event)
      if (!sh) throw new Error('Event tab not found: ' + event)
      const last = sh.getLastRow()
      const rows = last < 2 ? [] : sh.getRange(2, 1, last - 1, 7).getDisplayValues()
      const i = rows.findIndex((r) => r[0] !== '' && pad(r[0]) === ticket)
      const before = i < 0 ? null : rows[i]
      const result = !before ? 'not_found' : before[4] ? 'already_checked_in' : 'checked_in'
      if (result === 'checked_in') writeAt(sh, i + 2, 5, [[now, staffName, method]])
      appendTo('Log', [[now, event, ticket, result, staffName, staffRole, method]])
      return before
    } finally {
      lock.releaseLock()
    }
  },
}
