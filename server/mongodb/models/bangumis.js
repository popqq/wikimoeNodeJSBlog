var mongoose = require('mongoose');
var Schema = mongoose.Schema;
// Schema
var bangumis = new Schema({
  // 标题
  title: {
    type: String,
  },
  // 封面
  cover: {
    type: String,
  },
  // 简评
  summary: {
    type: String,
  },
  // 评分
  rating: {
    type: Number,
  },
  // 年份
  year: {
    type: Number,
  },
  // 季度
  season: {
    type: Number,
  },
  // label 字符串数组
  label: {
    type: [String],
    default: []
  },
  // 状态 0: 不显示 1: 显示
  status: {
    type: Number,
    default: 0
  },
}, { timestamps: true });

module.exports = mongoose.model('bangumis', bangumis);