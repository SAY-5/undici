'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const { once } = require('node:events')

const { Readable: BodyReadable } = require('../lib/api/readable.js')

// Regression test for #5002: setEncoding('utf8') on a response body used to
// corrupt multi-byte UTF-8 characters that straddled chunk boundaries
// because the stream set _readableState.encoding without installing a
// StringDecoder. Feed a single 3-byte CJK character across two chunks and
// confirm the decoded text has no U+FFFD replacement characters.
test('setEncoding(utf8) handles multi-byte chars across chunk boundaries', async () => {
  const body = new BodyReadable({
    resume () {},
    abort () {},
    contentType: 'text/plain; charset=utf-8'
  })

  body.setEncoding('utf8')

  // The Chinese character 中 is encoded as 3 bytes: 0xE4 0xB8 0xAD.
  // Push the first two bytes, then the last byte, to exercise the
  // chunk-boundary path.
  const buf = Buffer.from('中', 'utf8')
  assert.strictEqual(buf.length, 3)

  const chunks = []
  body.on('data', (c) => chunks.push(c))
  const ended = once(body, 'end')

  body.push(buf.subarray(0, 2))
  body.push(buf.subarray(2))
  body.push(null)

  await ended

  const decoded = chunks.join('')
  assert.strictEqual(decoded, '中')
  assert.strictEqual(decoded.indexOf('\uFFFD'), -1, 'should not contain U+FFFD')
})
