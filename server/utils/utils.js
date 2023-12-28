const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const validator = require('validator')
const fs = require('fs')
const path = require('path');
const { IP2Location } = require("ip2location-nodejs");
const parser = require('ua-parser-js');
const nodemailer = require('nodemailer')
const emailSendHistoryUtils = require('../mongodb/utils/emailSendHistorys')
const postUtils = require('../mongodb/utils/posts')
const commentUtils = require('../mongodb/utils/comments')
const { type } = require('os')

exports.creatSha256Str = function (str) {
  const sha256 = crypto.createHash('sha256')
  sha256.update(str)
  return sha256.digest('hex')
}
exports.HMACSHA256 = (str, secret) => {
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(str)
  return hmac.digest('hex')
}
exports.creatBcryptStr = function (str) {
  const salt = bcrypt.genSaltSync(10)
  const hash = bcrypt.hashSync(str, salt)
  return hash
}
exports.checkBcryptStr = function (str, hash) {
  return bcrypt.compareSync(str, hash)
}

exports.creatJWT = function (payload, exp) {
  const secret = process.env.JWT_SECRET
  const token = jwt.sign(payload, secret, { expiresIn: exp })
  return token
}
exports.checkJWT = function (token) {
  const secret = process.env.JWT_SECRET
  let result = null
  try {
    const decoded = jwt.verify(token, secret)
    result = {
      isError: false,
      data: decoded,
    }
    return result
  } catch (err) {
    // {"name":"TokenExpiredError","message":"jwt expired","expiredAt":"2022-03-03T02:36:11.000Z"}
    // {"name":"JsonWebTokenError","message":"invalid token"}
    result = {
      isError: true,
      errorData: { ...err },
    }
    return result
  }
}


exports.md5hex = (str /*: string */) => {
  const md5 = crypto.createHash('md5')
  return md5.update(str, 'utf8').digest('hex').toLowerCase()
}

exports.parseBase64 = (base64) => {
  if (!base64) {
    return null
  }
  const matches = base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/)
  if (matches.length !== 3) {
    return null
  }
  return {
    type: matches[1],
    data: matches[2],
    extension: matches[1].split('/')[1] || 'jpg',
  }
}


exports.checkForm = function (form, ruleArr) {
  const requiredCheck = function (required, value) {
    return required && checkVauleIsNone(value)
  }
  const checkVauleIsNone = function (value) {
    return value === null || value === undefined || value === ''
  }
  const result = []
  ruleArr.forEach((rule) => {
    const { key, label, type, required, options, errorMessage, reg } = rule
    const value = form[key]
    if (requiredCheck(required, value)) {
      result.push({
        key,
        message: `${label || key} 是必须项`
      })
    }
    if (type && !checkVauleIsNone(value)) {
      if (type === 'regCheck') {
        if (!reg.test(value)) {
          result.push({
            key,
            message: errorMessage || `${label || key} 内容有误`
          })
        }
      } else {
        const check = validator[type](String(value), options)
        if (!check && check !== 0) {
          result.push({
            key,
            message: errorMessage || `${label || key} 内容有误`
          })
        }
      }

    }
  })
  return result
}

exports.getUserIp = function (req) {
  let ip = (req.headers['x-forwarded-for'] || '').split(',')[0] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.connection.socket.remoteAddress || '';
  if (ip.substr(0, 7) == "::ffff:") {
    ip = ip.substr(7)
  }
  return ip;
};

// checkEnv
exports.checkEnv = function () {
  const envArr = [
    'DB_HOST',
    'JWT_SECRET',
  ]
  const result = []
  envArr.forEach((env) => {
    if (!process.env[env]) {
      result.push(env)
    }
  })
  // 如果有缺失的env直接关闭程序
  if (result.length > 0) {
    console.error('请在根目录下创建.env文件，并添加以下环境变量：', result.join(','))
    process.exit(1)
  }
}

// base64转图片文件
exports.base64ToFile = function (base64, destpath, fileName) {
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, '')
  const dataBuffer = Buffer.from(base64Data, 'base64')
  // 文件名后缀
  const extension = base64.match(/data:image\/(\w+);base64,/)[1]
  const fileNameAll = `${fileName}.${extension}`
  const filepath = path.join(destpath, fileNameAll)
  fs.writeFileSync(filepath, dataBuffer)
  return {
    filepath,
    fileNameAll
  }
}

// 生成多层级的树状结构
exports.generateTreeData = function (data, parentKey = 'parent') {
  const treeData = []
  const map = {}
  data.forEach((item) => {
    map[item._id] = item
  })
  data.forEach((item) => {
    const parent = map[item[parentKey]]
    if (parent) {
      (parent.children || (parent.children = [])).push(item)
    } else {
      treeData.push(item)
    }
  })
  return treeData
}


exports.initIp2location = function () {
  const binFilePath = path.join('./utils/ip2location/', process.env.IP2LOCATION_FILE_NAME)
  if (!fs.existsSync(binFilePath)) {
    console.error(('ip2location文件不存在,如果需要IP解析请先从：https://lite.ip2location.com 下载BIN文件，然后放到utils/ip2location目录下'))
    return
  }
  ip2location = new IP2Location();
  ip2location.open(binFilePath);
}
let ip2location = null
if (process.env.IP2LOCATION === '1') {
  this.initIp2location()
}
exports.IP2LocationUtils = function (ip, id, modelUtils, updateMongodb = true) {
  if (process.env.IP2LOCATION === '1') {
    const promise = new Promise((resolve, reject) => {
      console.time('ip2location')
      try {
        // 判断ip是否是ipv6
        const isIPV6 = ip.includes(':')
        // 如果是ipv6，ip2location只能解析ipv4，所以不对ipv6进行解析
        if (isIPV6) {
          console.log('ip2location不支持ipv6解析')
          resolve(null)
          return
        }
        // 判断ip是否是ipv4
        const ipV4Reg = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/
        const isIPV4 = ipV4Reg.test(ip)
        // 如果不是ipv4，直接返回null
        if (!isIPV4) {
          console.log('不是ipv4，跳过ip解析')
          resolve(null)
          return
        }
        const ipInfoAll = ip2location.getAll(String(ip).trim());
        // 遍历ipInfoAll，如果包含字符串This method is 就删除该属性
        Object.keys(ipInfoAll).forEach((key) => {
          if (ipInfoAll[key].includes('This method is not')) {
            delete ipInfoAll[key]
          }
        })

        console.timeEnd('ip2location')
        if (updateMongodb) {
          modelUtils.updateOne({ _id: id }, {
            ipInfo: ipInfoAll
          })
        }
        resolve(ipInfoAll)
      } catch (err) {
        console.error('ip2location解析失败', err)
        reject(err)
      }
    })
    return promise
  }
  console.log('ip2location未开启,跳过ip解析')
  return new Promise((resolve) => {
    resolve(null)
  })

}
exports.deviceUAInfoUtils = function (req) {
  const ua = parser(req.get('user-agent'))
  return ua
}
exports.deviceUtils = function (req, id, modelUtils) {
  const ua = this.deviceUAInfoUtils(req)
  const result = modelUtils.updateOne({ _id: id }, {
    deviceInfo: ua
  })
  return result
}
// isNumber
exports.isNumber = function (value) {
  return typeof value === 'number' && isFinite(value)
}

exports.isObjectId = function (value) {
  return value.match(/^[0-9a-fA-F]{24}$/)
}
// isUUID
exports.isUUID = function (value) {
  // 通过 validator isUUID 来判断
  return validator.isUUID(String(value))
}
// getTodayStartTime
exports.getTodayStartTime = function () {
  const date = new Date()
  date.setHours(0)
  date.setMinutes(0)
  date.setSeconds(0)
  return date
}
// getTodayEndTime
exports.getTodayEndTime = function () {
  const date = new Date()
  date.setHours(23)
  date.setMinutes(59)
  date.setSeconds(59)
  return date
}

// 写一个用nodemailer发送邮件的方法，参数是收件人邮箱和邮件内容和标题
exports.sendEmail = function (to, content, subject) {
  const emailSettings = global.$globalConfig.emailSettings
  const siteSettings = global.$globalConfig.siteSettings
  const { siteTitle } = siteSettings
  if (!emailSettings) {
    console.error('请在后台设置邮箱')
    return
  }
  const { emailSmtpHost, emailSmtpPort, emailSender, emailPassword } = emailSettings
  // 以上参数缺一不可
  if (!emailSmtpHost || !emailSmtpPort || !emailSender || !emailPassword) {
    console.error('请在后台设置邮箱')
    return
  }
  const transporter = nodemailer.createTransport({
    host: emailSmtpHost,
    port: emailSmtpPort,
    secure: true, // true for 465, false for other ports
    auth: {
      user: emailSender,
      pass: emailPassword
    }
  })
  const mailOptions = {
    from: emailSender,
    to,
    subject,
    html: content
  }
  const promise = new Promise((resolve, reject) => {
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error(error)
        reject(error)
        return
      }
      console.info('Message sent: %s', info.messageId)
      resolve(info)
    })
  })
  promise.then((info) => {
    const emailSendHistory = {
      to,
      content,
      status: 1
    }
    emailSendHistoryUtils.save(emailSendHistory)
  }).catch((err) => {
    const emailSendHistory = {
      to,
      content,
      status: 0,
      errInfo: JSON.stringify(err)
    }
    emailSendHistoryUtils.save(emailSendHistory)
  })
  return promise
}
// 发送评论添加通知，参数是文章信息post，评论信息comment
exports.sendCommentAddNotice = function (post, comment) {
  const siteSettings = global.$globalConfig.siteSettings
  const emailSettings = global.$globalConfig.emailSettings
  const { emailSendToMeTemplate, emailEnable, emailSendOptions, emailReceiver } = emailSettings

  // 如果没有设置emailSendToMeTemplate，就不发送邮件
  if (!emailSendToMeTemplate) {
    console.error('请在后台设置emailSendToMeTemplate')
    return
  }

  // 判断emailEnable为true，且emailSendOptions包含字符串receiveComment
  if (emailEnable && emailSendOptions.includes('receiveComment')) {
    const { siteUrl, siteTitle } = siteSettings
    const { title, _id, alias, excerpt } = post
    let { nickname, content, user } = comment
    if (user) {
      nickname = user.nickname
    }
    const to = emailReceiver
    const subject = `【${siteTitle}】的文章/推文有了新的评论`
    let contentHtml = emailSendToMeTemplate
    // 替换模板中的变量
    // ${comment}为评论内容
    // ${nickname}为评论者昵称
    // ${title}为文章标题
    // 其中${title}需要替换成a标签
    // 其中${siteTitle}为站点名称需要替换成a标签
    // 开始替换
    contentHtml = contentHtml.replace(/\${comment}/g, content)
    contentHtml = contentHtml.replace(/\${nickname}/g, nickname)
    contentHtml = contentHtml.replace(/\${title}/g, `<a href="${siteUrl}/post/${alias || _id}">${title || excerpt}</a>`)
    contentHtml = contentHtml.replace(/\${siteTitle}/g, `<a href="${siteUrl}">${siteTitle}</a>`)
    this.sendEmail(to, contentHtml, subject)
  }

}

// 发送回复评论通知，参数是文章信息post，评论信息comment，父级评论信息parentComment
exports.sendReplyCommentNotice = async function (post, comment) {
  if (typeof comment === 'string') {
    // 如果comment是字符串，说明是评论id，需要查询评论信息
    comment = await commentUtils.findOne({ _id: comment }, '', { userFilter: 'nickname _id email' })
  }
  if (!comment) {
    console.error('comment为必须参数')
    return
  }

  // 如果不存在post就查询post
  if (!post) {
    post = await postUtils.findOne({ _id: comment.post })
    if (!post) {
      console.error('post不存在')
      return
    }
  }


  let parentComment = await commentUtils.findOne({ _id: comment.parent }, '', { userFilter: 'nickname _id email' })
  if (!parentComment) {
    console.error('parentComment不存在')
    return
  }

  const parentCommentUser = parentComment.user || {}
  const commentUser = comment.user || {}
  const parentCommentIsAdmin = parentComment.user ? true : false
  const commentIsAdmin = comment.user ? true : false

  const parentCommentEmail = parentComment.email || parentCommentUser.email
  const commentEmail = comment.email || commentUser.email

  if (!parentCommentEmail) {
    console.error('parentComment.email不存在')
    return
  }
  if (parentCommentEmail === commentEmail) {
    console.log('父级评论者邮箱和评论者邮箱相同，不发送邮件')
    return
  }
  if (parentCommentIsAdmin) {
    console.log('父级评论者是管理员，不发送邮件')
    return
  }
  if (parentComment.status !== 1) {
    console.log('父级评论未审核通过，不发送邮件')
    return
  }
  const siteSettings = global.$globalConfig.siteSettings
  const emailSettings = global.$globalConfig.emailSettings
  const { emailSendToCommenterTemplate, emailEnable, emailSendOptions } = emailSettings

  // 如果没有设置emailSendToCommenterTemplate，就不发送邮件
  if (!emailSendToCommenterTemplate) {
    console.error('请在后台设置emailSendToCommenterTemplate')
    return
  }

  // 判断emailEnable为true，且emailSendOptions包含字符串receiveComment
  if (emailEnable && emailSendOptions.includes('replyComment')) {
    const { siteUrl, siteTitle } = siteSettings
    const { title, _id, alias, excerpt } = post
    let { nickname, content } = comment
    let { nickname: parentNickname, content: parentContent } = parentComment
    if (commentIsAdmin) {
      nickname = commentUser.nickname
    }
    if (parentCommentIsAdmin) {
      parentNickname = parentCommentUser.nickname
    }
    const to = parentCommentEmail
    const subject = `您在【${siteTitle}】发表的评论收到了回复`
    let contentHtml = emailSendToCommenterTemplate
    // 替换模板中的变量
    // ${comment}为评论内容
    // ${nickname}为评论者昵称
    // ${title}为文章标题
    // ${parentComment}为父级评论内容
    // ${parentNickname}为父级评论者昵称
    // 其中${title}需要替换成a标签
    // 其中${siteTitle}为站点名称需要替换成a标签
    // 开始替换
    contentHtml = contentHtml.replace(/\${comment}/g, content)
    contentHtml = contentHtml.replace(/\${nickname}/g, nickname)
    contentHtml = contentHtml.replace(/\${title}/g, `<a href="${siteUrl}/post/${alias || _id}">${title || excerpt}</a>`)
    contentHtml = contentHtml.replace(/\${siteTitle}/g, `<a href="${siteUrl}">${siteTitle}</a>`)
    contentHtml = contentHtml.replace(/\${parentComment}/g, parentContent)
    contentHtml = contentHtml.replace(/\${parentNickname}/g, parentNickname)
    this.sendEmail(to, contentHtml, subject)
  }

}