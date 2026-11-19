import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { sampleBusiness, scoreDimensions, platformResults } from '../lib/sample-data.ts'

function files(dir) {
 return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`])
}
const listed = 'ChatGPT, Gemini, Claude, Perplexity and Google AI Overviews'
test('customer-facing coverage treats five platforms equally', () => {
 const source = [...files('components/site'), 'lib/sample-data.ts', 'app/layout.tsx'].map(path => readFileSync(path, 'utf8')).join('\n')
 assert.doesNotMatch(source, /copilot|240|\d+\+? (?:searches|prompts) across/i)
 assert.doesNotMatch(source, /supplemental|additional signal|not represented as tested|not part of the Orange Score|does not affect/i)
 assert.match(source, /Hundreds of AI visibility checks/)
 assert.match(source, /Google AI Overviews/)
 assert.equal(source.includes(listed), true)
 assert.equal(sampleBusiness.platformsTested, 5)
})
test('sample scores stay illustrative and are not rewritten', () => {
 assert.equal(sampleBusiness.score, 62)
 assert.equal(platformResults.some(item => item.name === 'Claude'), false)
 const current = readFileSync('lib/sample-data.ts', 'utf8')
 const baseline = readFileSync('tests/fixtures/score-dimensions.txt', 'utf8')
 const dimensions = text => text.slice(text.indexOf('export const scoreDimensions'), text.indexOf('export type PlatformResult'))
 assert.equal(dimensions(current), baseline)
 assert.equal(scoreDimensions.length, 5)
})
