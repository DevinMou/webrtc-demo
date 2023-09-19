import WebSocket from 'ws'
type Fn = (...args: any[]) => any

class CustomWebSocket extends WebSocket.WebSocket {
  _promisePool: {[k: string]: Fn} = {}
}


const ramStr = (n = 5) => Array(n).fill(1).map(() => ((Math.random() * 36) | 0).toString(36)).join('')

const myPlugin = () => ({
  name: 'rtc-server',
  configureServer() {
    return () => {
      const wss = new WebSocket.Server<typeof CustomWebSocket>({port: 5174})
      const liveList: {name: string; ws: CustomWebSocket}[] = []
      const sendBack = (ws: CustomWebSocket, hash: string, $type: string, msg: any, callBack?: Fn) => {
        const params = {
          hash,
          type: $type,
          data: msg,
          callbackHash: ''
        }
        if (callBack) {
          params.callbackHash = ramStr()
          ws._promisePool[params.callbackHash] = callBack
        }
        ws.send(JSON.stringify(params))
      }
      wss.on('connection', ws => {
        ws._promisePool = {}
        ws.on('message', message => {
          const msg = message instanceof Buffer ? message.toString() : message
          try {
            const {hash, type, data} = JSON.parse(msg as string)
            const localSend = ($type: string, msg: any) => sendBack(ws, hash, $type, msg)
            console.log(37, type)
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
                  const changeData = liveList.map(e => ({...e, ws: !!e.ws}))
                  liveList.forEach(item => sendBack(item.ws, '', 'liveListChange', changeData))
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
          } catch (err) {
            console.log(err)
          }
        })

        ws.on('close', () => {
          const index = liveList.findIndex(e => e.ws === ws)
          if (index > -1) {
            Reflect.deleteProperty(liveList, index)
            const changeData = liveList.map(e => ({...e, ws: !!e.ws}))
            liveList.forEach(item => {
              sendBack(item.ws, '', 'liveListChange', changeData)
            })
          }
          console.log('webSocket connection closed')
        })
      })
    }
  }
})

export default myPlugin