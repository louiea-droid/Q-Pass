import { expect, test } from 'vitest'
import { pageList } from './pagination'

test('few pages: show them all', () => {
  expect(pageList(1, 1)).toEqual([1])
  expect(pageList(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
})

test('near the start: first five, gap, last', () => {
  expect(pageList(1, 41)).toEqual([1, 2, 3, 4, 5, '…', 41])
  expect(pageList(4, 41)).toEqual([1, 2, 3, 4, 5, '…', 41])
})

test('in the middle: first, gap, neighbours, gap, last', () => {
  expect(pageList(10, 41)).toEqual([1, '…', 9, 10, 11, '…', 41])
})

test('near the end: first, gap, last five', () => {
  expect(pageList(41, 41)).toEqual([1, '…', 37, 38, 39, 40, 41])
  expect(pageList(38, 41)).toEqual([1, '…', 37, 38, 39, 40, 41])
})
