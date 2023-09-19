const Koa = require('koa')
const Router = require('koa-router')
const fs = require('fs')
const path = require('path')
const Ws = require('ws')
const app = new Koa()
const router = new Router()

const ramStr = (n = 5) => Array(n).fill(1).map(() => ((Math.random() * 36) | 0).toString(36)).join('')

app.use(router.routes()).use(router.allowedMethods())

app.use(async ctx => {
  const {url} = ctx.request
  if (url === '/') {
    ctx.type = 'text/html'
    ctx.body = fs.readFileSync(path.join(__dirname, './src/client.html'), 'utf-8')
  }
})

const server = app.listen(3000, () => {
  console.log('listing on port 3000')
})

const wss = new Ws.Server({server})
const liveList = []
const sendBack = (ws, hash, $type, msg, callBack) => {
  const params = {
    hash,
    type: $type,
    data: msg
  }
  if (callBack) {
    params.callbackHash = ramStr()
    ws._promisePool[params.callbackHash] = callBack
  }
  ws.send(JSON.stringify(params))
}
wss.on('connection', ws => {
  ws._promisePool = []
  ws.on('message', message => {
    const msg = message instanceof Buffer ? message.toString() : message
    try {
      const {hash, type, data} = JSON.parse(msg)
      const localSend = ($type, msg) => sendBack(ws, hash, $type, msg)
      console.log(45, type)
      switch (type) {
        case 'callback':
          if (ws._promisePool[hash]) {
            ws._promisePool[hash](data)
            Reflect.deleteProperty(ws._promisePool, hash)
          }
          break
        case 'login':
          if (liveList.find(e => e.name === data)) {
            localSend('callback', 'you has logined')
          } else {
            liveList.push({
              name: data,
              ws
            })
            localSend('callback', 'login success')
          }
          break
        case 'getLiveList':
          localSend('callback', liveList.map(e => ({...e, ws: !!e.ws})))
          break
        case 'sendDSP':
          {
            const {requestName,receiveName,dsp} = data
            const receiveItem = liveList.find(e => e.name === receiveName)
            if (receiveItem) {
              sendBack(receiveItem.ws, '', 'remoteDSP', {
                requestName,
                dsp
              }, res => {
                localSend('callback', res)
              })
            }
          }
          break
        case 'sendICE':
          {
            const {requestName,receiveName,ice} = data
            const receiveItem = liveList.find(e => e.name === receiveName)
            if (receiveItem) {
              sendBack(receiveItem.ws, '', 'remoteICE', {
                requestName,
                ice
              }, res => {
                localSend('callback', res)
              })
            }
          }
          break
      }
    } catch {}
  })

  ws.on('close', () => {
    console.log('webSocket connection closed')
  })
})
