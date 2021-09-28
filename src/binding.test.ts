
import test from 'ava'

import { buildURL } from './binding.js'


test('build url without parameters', t => {
  t.is(buildURL('/foo/bar', {}), '/foo/bar')
})

test('build url with simple parameters', t => {
  t.is(buildURL('/foo/{bar}/baz', { bar: 'testing' }), '/foo/testing/baz')
})

test('build url with verb', t => {
  t.is(buildURL('/foo/bar:baz', {}), '/foo/bar:baz')
})

test('build url with variable near verb', t => {
  t.is(buildURL('/foo/{bar}:baz', { bar: 'qux' }), '/foo/qux:baz')
})

test('build url with complex parameters', t => {
  t.is(buildURL('/foo/{bar=projects/*/events/*}/baz', { bar: 'projects/foo/events/bar' }), '/foo/projects/foo/events/bar/baz')
})

test('build url with missing parameters', t => {
  t.throws(() => buildURL('/foo/{bar=projects/*}/baz', { other: 'foo' }), {
    message: 'input parameter bar is required',
  })
})
