'use strict'

const webpush = require('web-push')
const db = require('../database')

// ── VAPID setup ────────────────────────────────────────────────────────────

let vapidConfigured = false

function setupVapid() {
  if (vapidConfigured) return
  const pub  = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const subj = process.env.VAPID_SUBJECT || 'mailto:admin@anjanimedical.in'

  if (pub && priv) {
    webpush.setVapidDetails(subj, pub, priv)
    vapidConfigured = true
  } else {
    console.warn('[Push] VAPID keys not set — web push notifications disabled.')
    console.warn('[Push] Generate keys: node -e "console.log(require(\'web-push\').generateVAPIDKeys())"')
    console.warn('[Push] Then set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in .env')
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getSubscriptionsForUser(userId, staffId) {
  if (userId) {
    return db.prepare(
      'SELECT * FROM push_subscriptions WHERE user_id = ? AND is_active = 1'
    ).all(userId)
  }
  if (staffId) {
    return db.prepare(
      'SELECT * FROM push_subscriptions WHERE staff_id = ? AND is_active = 1'
    ).all(staffId)
  }
  return []
}

function markSubFailed(id) {
  db.prepare(
    "UPDATE push_subscriptions SET is_active=0, last_failure_at=datetime('now'), updated_at=datetime('now') WHERE id=?"
  ).run(id)
}

function markSubSuccess(id) {
  db.prepare(
    "UPDATE push_subscriptions SET last_success_at=datetime('now'), updated_at=datetime('now') WHERE id=?"
  ).run(id)
}

// ── Core send function ─────────────────────────────────────────────────────

/**
 * Create an in-app notification and (if enabled) send a web push to the
 * user/staff's subscribed devices.
 *
 * All fields are optional except title.
 */
async function sendNotification({
  userId       = null,
  staffId      = null,
  title,
  message      = '',
  type         = 'task',
  priority     = 'normal',
  requiresAction = false,
  clearable    = true,
  relatedModule   = null,
  relatedEntityId = null,
  relatedTaskId   = null,
  relatedToken    = null,
  actionUrl    = null,
  dedupKey     = null,
  dueAt        = null,
}) {
  setupVapid()

  // ── 1. Save in-app notification ──────────────────────────────────────────
  let notifId = null
  try {
    const stmt = db.prepare(`
      INSERT ${dedupKey ? 'OR IGNORE' : ''} INTO notifications
        (user_id, target_staff_id, title, message, type, priority,
         requires_action, clearable, action_url, related_token,
         related_schedule_id, related_task_id, dedup_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const info = stmt.run(
      userId, staffId, title, message, type, priority,
      requiresAction ? 1 : 0,
      clearable ? 1 : 0,
      actionUrl,
      relatedToken,
      relatedModule === 'patient_refill' ? relatedEntityId : null,
      relatedTaskId,
      dedupKey
    )
    if (info.lastInsertRowid) notifId = info.lastInsertRowid
  } catch (err) {
    // dedup collision — notification already exists, still try push
    if (!err.message?.includes('UNIQUE')) {
      console.error('[Notif] DB insert error:', err.message)
    }
  }

  // ── 2. Send push notifications ───────────────────────────────────────────
  if (!vapidConfigured) return { notifId }

  const subs = getSubscriptionsForUser(userId, staffId)
  if (subs.length === 0) return { notifId }

  const payload = JSON.stringify({
    title,
    body: message,
    icon: '/brand/logo.png',
    badge: '/favicon.svg',
    tag: dedupKey || `anjani-${type}-${Date.now()}`,
    requireInteraction: requiresAction,
    data: {
      actionUrl: actionUrl || '/',
      notificationId: notifId,
      relatedModule,
      relatedEntityId,
      relatedToken,
      requiresAction,
    },
  })

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { TTL: 86400 }
        )
        markSubSuccess(sub.id)
      } catch (err) {
        console.error(`[Push] Failed to send to sub ${sub.id}:`, err.statusCode || err.message)
        if (err.statusCode === 410 || err.statusCode === 404) {
          markSubFailed(sub.id)
        }
      }
    })
  )

  return { notifId }
}

/**
 * Check if a daily reminder was already sent today.
 * key = unique string identifying this reminder (module + entity + staff + type + date)
 */
function alreadySentToday(key) {
  const row = db.prepare('SELECT id FROM notification_reminder_log WHERE reminder_key = ?').get(key)
  return !!row
}

function logReminder(key, module, entityId, staffId, userId) {
  try {
    db.prepare(`
      INSERT OR IGNORE INTO notification_reminder_log
        (reminder_key, related_module, related_entity_id, staff_id, user_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(key, module, entityId, staffId, userId)
  } catch { /* non-fatal */ }
}

module.exports = { sendNotification, alreadySentToday, logReminder, setupVapid }
