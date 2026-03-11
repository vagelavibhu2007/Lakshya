const express = require('express');
const Todo = require('../models/Todo');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();
router.use(verifyToken);

// GET /api/todos — own todos only
router.get('/', async (req, res, next) => {
  try {
    const todos = await Todo.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json({ success: true, todos });
  } catch (err) {
    next(err);
  }
});

// POST /api/todos
router.post('/', async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Text is required' });
    }
    const todo = await Todo.create({ userId: req.user.id, text: text.trim() });
    res.status(201).json({ success: true, todo });
  } catch (err) {
    next(err);
  }
});

// PUT /api/todos/:id — toggle or update text
router.put('/:id', async (req, res, next) => {
  try {
    const todo = await Todo.findById(req.params.id);
    if (!todo) return res.status(404).json({ success: false, message: 'Todo not found' });
    if (todo.userId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not your todo' });
    }

    if (req.body.text !== undefined) todo.text = req.body.text.trim();
    if (req.body.completed !== undefined) todo.completed = req.body.completed;
    await todo.save();

    res.json({ success: true, todo });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/todos/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const todo = await Todo.findById(req.params.id);
    if (!todo) return res.status(404).json({ success: false, message: 'Todo not found' });
    if (todo.userId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not your todo' });
    }
    await Todo.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;