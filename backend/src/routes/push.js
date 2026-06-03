'use strict'

const express = require('express')
const db = require('../database')
const { sendNotification, setupVapid } = require('../utils/notificationService')

const router = express.Router()

// GET /api/push/vapid-public-key  — public, no auth
router.get('/vapid-public-key', (_req, res) => {
  setupVapid()
  const key = process.env.VAPID_PUBLIC_KEY || null
  if (!key) {
    return res.status(503).json({ error: 'Push notifications not configured on this server.', key: null })
  }
  res.json({ key })
})

// POST /api/push/subscribe  — save/update a push subscription for the logged-in user
router.post('/subscribe', (req, res) => {
  const user = req.currentUser
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { endpoint, keys, userAgent, deviceLabel } = req.body
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: 'Missing subscription fields.' })
  }

  try {
    db.prepare(`
      INSERT INTO push_subscriptions
        (user_id, staff_id, endpoint, p256dh, auth, user_agent, device_label, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      ON CONFLICT(endpoint) DO UPDATE SET
        user_id=excluded.user_id,
        staff_id=excluded.staff_id,
        p256dh=excluded.p256dh,
        auth=excluded.auth,
        user_agent=excluded.user_agent,
        device_label=excluded.device_label,
        is_active=1,
        updated_at=datetime('now')
    `).run(
      user.id,
      user.staff_id || null,
      endpoint,
      keys.p256dh,
      keys.auth,
      userAgent || req.headers['user-agent'] || null,
      deviceLabel || null
    )
    res.json({ success: true, message: 'Push subscription saved.' })
  } catch (err) {
    console.error('[Push] Subscribe error:', err.message)
    res.status(500).json({ error: 'Failed to save subscription.' })
  }
})

// DELETE /api/push/subscribe  — remove a subscription
router.delete('/subscribe', (req, res) => {
  const user = req.currentUser
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { endpoint } = req.body
  if (!endpoint) return res.status(400).json({ error: 'Missing endpoint.' })

  db.prepare(
    'UPDATE push_subscriptions SET is_active=0, updated_at=datetime(\'now\') WHERE endpoint=? AND user_id=?'
  ).run(endpoint, user.id)

  res.json({ success: true })
})

// GET /api/push/status  — return subscription status for current user
router.get('/status', (req, res) => {
  const user = req.currentUser
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const subs = db.prepare(
    'SELECT id, device_label, user_agent, last_success_at, created_at FROM push_subscriptions WHERE user_id=? AND is_active=1'
  ).all(user.id)

  res.json({
    hasActiveSubscriptions: subs.length > 0,
    subscriptions: subs,
    vapidConfigured: !!process.env.VAPID_PUBLIC_KEY,
  })
})

// POST /api/push/test  — send a test push to the current user
router.post('/test', async (req, res) => {
  const user = req.currentUser
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const result = await sendNotification({
      userId: user.id,
      staffId: user.staff_id,
      title: 'Test Notification',
      message: `Push working for ${user.display_name || user.username}! Tap to open the app.`,
      type: 'system',
      priority: 'normal',
      requiresAction: false,
      clearable: true,
      actionUrl: '/',
    })
    res.json({ success: true, notifId: result.notifId })
  } catch (err) {
    console.error('[Push] Test error:', err.message)
    res.status(500).json({ error: 'Failed to send test notification.' })
  }
})

module.exports = router
