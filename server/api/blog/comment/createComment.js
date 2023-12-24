const commentUtils = require('../../../mongodb/utils/comments')
const postUtils = require('../../../mongodb/utils/posts')
const utils = require('../../../utils/utils')
const log4js = require('log4js')
const userApiLog = log4js.getLogger('userApi')
const cacheDataUtils = require('../../../config/cacheData')


module.exports = async function (req, res, next) {

  const { post, parent, content, nickname, email, url } = req.body
  // 获取全局配置
  const { siteEnableComment, siteCommentInterval, siteEnableCommentReview } = global.$globalConfig.commentSettings
  // 如果siteEnableComment为false，则不允许评论
  if (!siteEnableComment) {
    res.status(400).json({
      errors: [{
        message: '评论功能已关闭'
      }]
    })
    return
  }
  // 从header中获取uuid
  const uuid = req.headers['x-request-id']


  const ip = utils.getUserIp(req)
  // 校验格式
  const params = {
    post,
    content,
    nickname,
    uuid,
    ip: ip
  }
  if (email) {
    params.email = email
  }
  if (url) {
    params.url = url
  }
  const rule = [
    {
      key: 'post',
      label: '评论文章',
      type: null,
      required: true,
    },
    {
      key: 'content',
      label: '评论内容',
      type: null,
      required: true,
    },
    {
      key: 'nickname',
      label: '昵称',
      type: null,
      required: true,
    },
    {
      key: 'email',
      label: '邮箱地址',
      type: 'isEmail',
      required: false,
    },
    // uuid
    {
      key: 'uuid',
      label: '内容参数',
      type: 'isUUID',
      required: true,
    },
  ]
  const errors = utils.checkForm(params, rule)
  if (errors.length > 0) {
    res.status(400).json({ errors })
    return
  }
  // 获取文章信息
  const postInfo = await postUtils.findOne({ _id: post })
  if (!postInfo) {
    res.status(400).json({
      errors: [{
        message: '文章不存在'
      }]
    })
    return
  }

  // 根据siteCommentInterval（单位秒） 判断该uuid/ip上次的评论时间（date）是否在siteCommentInterval秒内
  if (!siteCommentInterval) {
    res.status(400).json({
      errors: [{
        message: '评论间隔未设置'
      }]
    })
    return
  }
  // 如果为0，则不限制评论间隔
  if (siteCommentInterval !== 0) {
    const now = new Date()
    // 当前时间减去siteCommentInterval秒
    const lastTime = new Date(now.getTime() - siteCommentInterval * 1000)
    const params = {
      $or: [
        { uuid: uuid },
        { ip: ip }
      ],
      date: {
        $gt: lastTime
      }
    }
    const lastComment = await commentUtils.findOne(
      params
    )
    if (lastComment) {
      res.status(400).json({
        errors: [{
          message: '发送的评论过于频繁，请稍后再试'
        }]
      })
      return
    }
  }

  // 根据siteEnableCommentReview判断是否需要审核
  if (siteEnableCommentReview) {
    params.status = 0
  } else {
    params.status = 1
  }

  if (parent) {
    // 校验parent是否是ObjectId
    if (!utils.isObjectId(parent)) {
      res.status(400).json({
        errors: [{
          message: 'parent格式错误'
        }]
      })
      return
    }
    params.parent = parent
  }


  // save
  commentUtils.save(params).then((data) => {
    res.send({
      status: params.status
    })
    userApiLog.info(`comment:${content} create success`)
    // 异步更新设备信息
    utils.deviceUtils(req, data._id, commentUtils)
    // 异步更新ip信息
    utils.IP2LocationUtils(ip, data._id, commentUtils)
    if (params.status === 1) {
      // 异步更新文章评论数
      postUtils.updateOne({ _id: post }, { $inc: { comnum: 1 } }, true)
      cacheDataUtils.getCommentList()
    }
    // TODO: 发送邮件通知
  }).catch((err) => {
    console.error(err)
    res.status(400).json({
      errors: [{
        message: '评论创建失败'
      }]
    })
    userApiLog.error(`comment:${content} create fail, ${JSON.stringify(err)}`)
  })

}