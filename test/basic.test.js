'use strict'

const Writable = require('stream').Writable
const os = require('os')
const test = require('tap').test
const pino = require('pino')
const dateformat = require('dateformat')
const prettyFactory = require('../')

// All dates are computed from 'Fri, 30 Mar 2018 17:35:28 GMT'
const epoch = 1522431328992
const pid = process.pid
const hostname = os.hostname()

test('basic prettifier tests', (t) => {
  t.beforeEach((done) => {
    Date.originalNow = Date.now
    Date.now = () => epoch

    done()
  })
  t.afterEach((done) => {
    Date.now = Date.originalNow
    delete Date.originalNow

    done()
  })

  t.test('preserves output if not valid JSON', (t) => {
    t.plan(1)
    const pretty = prettyFactory()
    const formatted = pretty('this is not json\nit\'s just regular output\n')
    t.is(formatted, 'this is not json\nit\'s just regular output\n\n')
  })

  t.test('formats a line without any extra options', (t) => {
    t.plan(1)
    const pretty = prettyFactory()
    const log = pino({}, new Writable({
      write (chunk, enc, cb) {
        const formatted = pretty(chunk.toString())
        t.is(
          formatted,
          `[${epoch}] INFO (${pid} on ${hostname}): foo\n`
        )
        cb()
      }
    }))
    log.info('foo')
  })

  t.test('will add color codes', (t) => {
    t.plan(1)
    const pretty = prettyFactory({colorize: true})
    const log = pino({}, new Writable({
      write (chunk, enc, cb) {
        const formatted = pretty(chunk.toString())
        t.is(
          formatted,
          `[${epoch}] \u001B[32mINFO\u001B[39m (${pid} on ${hostname}): \u001B[36mfoo\u001B[39m\n`
        )
        cb()
      }
    }))
    log.info('foo')
  })

  t.test('can swap date and level position', (t) => {
    t.plan(1)
    const pretty = prettyFactory({levelFirst: true})
    const log = pino({}, new Writable({
      write (chunk, enc, cb) {
        const formatted = pretty(chunk.toString())
        t.is(
          formatted,
          `INFO [${epoch}] (${pid} on ${hostname}): foo\n`
        )
        cb()
      }
    }))
    log.info('foo')
  })

  t.test('can use different message keys', (t) => {
    t.plan(1)
    const pretty = prettyFactory({messageKey: 'bar'})
    const log = pino({}, new Writable({
      write (chunk, enc, cb) {
        const formatted = pretty(chunk.toString())
        t.is(
          formatted,
          `[${epoch}] INFO (${pid} on ${hostname}): baz\n`
        )
        cb()
      }
    }))
    log.info({bar: 'baz'})
  })

  t.test('will format date to UTC', (t) => {
    t.plan(1)
    const pretty = prettyFactory({translateTime: true})
    const log = pino({}, new Writable({
      write (chunk, enc, cb) {
        const formatted = pretty(chunk.toString())
        t.is(
          formatted,
          `[2018-03-30 17:35:28.992 +0000] INFO (${pid} on ${hostname}): foo\n`
        )
        cb()
      }
    }))
    log.info('foo')
  })

  t.test('will format date to local time', (t) => {
    t.plan(1)
    const pretty = prettyFactory({
      translateTime: true,
      localTime: true
    })
    const log = pino({}, new Writable({
      write (chunk, enc, cb) {
        const formatted = pretty(chunk.toString())
        const localHour = dateformat(epoch, 'HH')
        const localDate = dateformat(epoch, 'yyyy-mm-dd')
        const offset = dateformat(epoch, 'o')
        t.is(
          formatted,
          `[${localDate} ${localHour}:35:28.992 ${offset}] INFO (${pid} on ${hostname}): foo\n`
        )
        cb()
      }
    }))
    log.info('foo')
  })

  t.test('will format date with a custom format string', (t) => {
    t.plan(1)
    const pretty = prettyFactory({dateFormat: 'yyyy-mm-dd HH:MM'})
    const log = pino({}, new Writable({
      write (chunk, enc, cb) {
        const formatted = pretty(chunk.toString())
        t.is(
          formatted,
          `[2018-03-30 17:35] INFO (${pid} on ${hostname}): foo\n`
        )
        cb()
      }
    }))
    log.info('foo')
  })

  t.test('handles missing time', (t) => {
    t.plan(1)
    const pretty = prettyFactory()
    const formatted = pretty('{"hello":"world"}')
    t.is(formatted, '{"hello":"world"}\n')
  })

  t.test('handles missing pid, hostname and name', (t) => {
    t.plan(1)
    const pretty = prettyFactory()
    const log = pino({base: null}, new Writable({
      write (chunk, enc, cb) {
        const formatted = pretty(chunk.toString())
        t.match(formatted, /\[.*\] INFO: hello world/)
        cb()
      }
    }))
    log.info('hello world')
  })

  t.test('handles missing pid', (t) => {
    t.plan(1)
    const pretty = prettyFactory()
    const name = 'test'
    const msg = 'hello world'
    const regex = new RegExp('\\[.*\\] INFO \\(' + name + ' on ' + hostname + '\\): ' + msg)

    const opts = {
      base: {
        name: name,
        hostname: hostname
      }
    }
    const log = pino(opts, new Writable({
      write (chunk, enc, cb) {
        const formatted = pretty(chunk.toString())
        t.match(formatted, regex)
        cb()
      }
    }))

    log.info(msg)
  })

  t.test('handles missing hostname', (t) => {
    t.plan(1)
    const pretty = prettyFactory()
    const name = 'test'
    const msg = 'hello world'
    const regex = new RegExp('\\[.*\\] INFO \\(' + name + '/' + pid + '\\): ' + msg)

    const opts = {
      base: {
        name: name,
        pid: process.pid
      }
    }
    const log = pino(opts, new Writable({
      write (chunk, enc, cb) {
        const formatted = pretty(chunk.toString())
        t.match(formatted, regex)
        cb()
      }
    }))

    log.info(msg)
  })

  t.test('handles missing name', (t) => {
    t.plan(1)
    const pretty = prettyFactory()
    const msg = 'hello world'
    const regex = new RegExp('\\[.*\\] INFO \\(' + process.pid + ' on ' + hostname + '\\): ' + msg)

    const opts = {
      base: {
        hostname: hostname,
        pid: process.pid
      }
    }
    const log = pino(opts, new Writable({
      write (chunk, enc, cb) {
        const formatted = pretty(chunk.toString())
        t.match(formatted, regex)
        cb()
      }
    }))

    log.info(msg)
  })

  t.test('works without time', (t) => {
    t.plan(1)
    const pretty = prettyFactory()
    const log = pino({timestamp: null}, new Writable({
      write (chunk, enc, cb) {
        const formatted = pretty(chunk.toString())
        t.is(formatted, `[undefined] INFO (${pid} on ${hostname}): hello world\n`)
        cb()
      }
    }))
    log.info('hello world')
  })

  t.test('prettifies properties', (t) => {
    t.plan(1)
    const pretty = prettyFactory()
    const log = pino({}, new Writable({
      write (chunk, enc, cb) {
        const formatted = pretty(chunk.toString())
        t.match(formatted, '    a: "b"')
        cb()
      }
    }))
    log.info({a: 'b'}, 'hello world')
  })

  t.test('prettifies nested properties', (t) => {
    t.plan(6)
    const expectedLines = [
      '    a: {',
      '      "b": {',
      '        "c": "d"',
      '      }',
      '    }'
    ]
    const pretty = prettyFactory()
    const log = pino({}, new Writable({
      write (chunk, enc, cb) {
        const formatted = pretty(chunk.toString())
        const lines = formatted.split('\n')
        t.is(lines.length, expectedLines.length + 2)
        lines.shift(); lines.pop()
        for (var i = 0; i < lines.length; i += 1) {
          t.is(lines[i], expectedLines[i])
        }
        cb()
      }
    }))
    log.info({ a: { b: { c: 'd' } } }, 'hello world')
  })

  t.test('treats the name with care', (t) => {
    t.plan(1)
    const pretty = prettyFactory()
    const log = pino({name: 'matteo'}, new Writable({
      write (chunk, enc, cb) {
        const formatted = pretty(chunk.toString())
        t.is(formatted, `[${epoch}] INFO (matteo/${pid} on ${hostname}): hello world\n`)
        cb()
      }
    }))
    log.info('hello world')
  })

  t.test('handles `null` input', (t) => {
    t.plan(1)
    const pretty = prettyFactory()
    const formatted = pretty(null)
    t.is(formatted, 'null\n')
  })

  t.test('handles `undefined` input', (t) => {
    t.plan(1)
    const pretty = prettyFactory()
    const formatted = pretty(undefined)
    t.is(formatted, 'undefined\n')
  })

  t.test('handles `true` input', (t) => {
    t.plan(1)
    const pretty = prettyFactory()
    const formatted = pretty(true)
    t.is(formatted, 'true\n')
  })

  t.test('handles customLogLevel', (t) => {
    t.plan(1)
    const pretty = prettyFactory()
    const log = pino({level: 'testCustom', levelVal: 35}, new Writable({
      write (chunk, enc, cb) {
        const formatted = pretty(chunk.toString())
        t.match(formatted, /USERLVL/)
        cb()
      }
    }))
    log.testCustom('test message')
  })

  t.test('supports pino metadata API', (t) => {
    t.plan(1)
    const dest = new Writable({
      write (chunk, enc, cb) {
        t.is(
          chunk.toString(),
          `[${epoch}] INFO (${pid} on ${hostname}): foo\n`
        )
        cb()
      }
    })
    const prettyStream = prettyFactory().asMetaWrapper(dest)
    const log = pino({}, prettyStream)
    log.info('foo')
  })

  t.test('can swap date and level position through meta stream', (t) => {
    t.plan(1)

    const dest = new Writable({
      objectMode: true,
      write (formatted, enc, cb) {
        t.is(
          formatted,
          `INFO [${epoch}] (${pid} on ${hostname}): foo\n`
        )
        cb()
      }
    })

    const prettyStream = prettyFactory({ levelFirst: true }).asMetaWrapper(dest)
    const log = pino({}, prettyStream)
    log.info('foo')
  })

  t.end()
})
