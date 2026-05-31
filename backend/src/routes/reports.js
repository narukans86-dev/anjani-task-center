'use strict'

const express = require('express')
const db = require('../database')

const router = express.Router()

const today = () => new Date().toISOString().slice(0, 10)

// GET /api/reports/staff-performance
router.get('/staff-performance', (_req, res) => {
  const date = today()
  const rows = db.prepare(`
    SELECT
      assigned_to,
      COUNT(*) AS assigned,
      SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN due_date < ? AND status NOT IN ('completed','cancelled') THEN 1 ELSE 0 END) AS delayed,
      ROUND(
        100.0 * SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) / COUNT(*),
        1
      ) AS completion_pct
    FROM tasks
    WHERE assigned_to IS NOT NULL
    GROUP BY assigned_to
    ORDER BY completion_pct DESC
  `).all(date)
  res.json(rows)
})

// GET /api/reports/department
router.get('/department', (_req, res) => {
  const date = today()
  const rows = db.prepare(`
    SELECT
      category,
      COUNT(*) AS total,
      SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN due_date < ? AND status NOT IN ('completed','cancelled') THEN 1 ELSE 0 END) AS delayed
    FROM tasks
    WHERE category IS NOT NULL
    GROUP BY category
    ORDER BY total DESC
  `).all(date)
  res.json(rows)
})

// GET /api/reports/daily — today's summary
router.get('/daily', (_req, res) => {
  const date = today()

  const tasks = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN due_date < ? AND status NOT IN ('completed','cancelled') THEN 1 ELSE 0 END) AS delayed
    FROM tasks WHERE due_date = ?
  `).get(date, date)

  const clStat = (type) => {
    const total = db.prepare(
      "SELECT COUNT(*) AS n FROM checklists WHERE active=1 AND type=?"
    ).get(type).n
    const completed = db.prepare(`
      SELECT COUNT(DISTINCT c.id) AS n
      FROM checklists c
      JOIN checklist_completions cc ON cc.checklist_id=c.id AND cc.completed_date=?
      WHERE c.active=1 AND c.type=?
    `).get(date, type).n
    return { total, completed }
  }

  res.json({
    date,
    tasks,
    checklist: {
      opening: clStat('opening'),
      closing: clStat('closing'),
    },
  })
})

// GET /api/reports/priority
router.get('/priority', (_req, res) => {
  const rows = db.prepare(`
    SELECT
      priority,
      COUNT(*) AS total,
      SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN status='in_progress' THEN 1 ELSE 0 END) AS in_progress
    FROM tasks
    GROUP BY priority
    ORDER BY CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END
  `).all()
  res.json(rows)
})

module.exports = router
