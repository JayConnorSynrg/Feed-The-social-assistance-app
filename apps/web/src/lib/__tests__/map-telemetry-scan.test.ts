// map-telemetry-scan.test.ts — fixtures proving the Mapbox telemetry scanner
// catches every shape it claims to, and does not fail on correct code.
import { describe, it, expect } from 'vitest'
import { scanMapTelemetry } from './map-telemetry-scan.mjs'

const scan = (src: string) => scanMapTelemetry([{ file: 'fixture.tsx', src }])
const reasons = (src: string) => scan(src).violations.map((v) => v.reason)

describe('map telemetry scanner — fixtures', () => {
  it('passes the correct shape (default import, prop set)', () => {
    const r = scan(`import Map from 'react-map-gl/mapbox'\nexport const A = () => <Map mapStyle="x" performanceMetricsCollection={false} />`)
    expect(r.uses).toHaveLength(1)
    expect(r.violations).toEqual([])
  })

  it('flags a renamed default import without the prop', () => {
    expect(reasons(`import MapGL from 'react-map-gl/mapbox'\nconst A = () => <MapGL mapStyle="x" />`)).toEqual(['missing performanceMetricsCollection={false}'])
  })

  it('flags `{ Map as M }` and `{ default as M }` named imports', () => {
    expect(reasons(`import { Map as M } from 'react-map-gl'\nconst A = () => <M />`)).toHaveLength(1)
    expect(reasons(`import { default as M } from '@vis.gl/react-mapbox'\nconst A = () => <M />`)).toHaveLength(1)
  })

  it('flags a namespace import use', () => {
    expect(reasons(`import * as RMG from 'react-map-gl/mapbox'\nconst A = () => <RMG.Map />`)).toHaveLength(1)
  })

  it('flags a double-quoted import', () => {
    expect(reasons(`import Map from "react-map-gl/mapbox"\nconst A = () => <Map />`)).toEqual(['missing performanceMetricsCollection={false}'])
  })

  it('parses past `=>` inside props (no false failure, no false pass)', () => {
    expect(reasons(`import Map from 'react-map-gl/mapbox'\nconst A = () => <Map onMove={(e) => go(e)} onLoad={() => { a > b }} performanceMetricsCollection={false} />`)).toEqual([])
    expect(reasons(`import Map from 'react-map-gl/mapbox'\nconst A = () => <Map onMove={(e) => go(e)} performanceMetricsCollection={true} />`)).toEqual(['performanceMetricsCollection={true}'])
  })

  it('flags ={true}', () => {
    expect(reasons(`import Map from 'react-map-gl/mapbox'\nconst A = () => <Map performanceMetricsCollection={true} />`)).toEqual(['performanceMetricsCollection={true}'])
  })

  it('flags a spread placed after the prop', () => {
    expect(reasons(`import Map from 'react-map-gl/mapbox'\nconst A = (p) => <Map performanceMetricsCollection={false} {...p} />`)).toEqual(['a later {...spread} can override the prop'])
  })

  it('flags a direct mapbox-gl constructor without the option, passes it with', () => {
    expect(reasons(`import mapboxgl from "mapbox-gl"\nnew mapboxgl.Map({ container: 'x' })`)).toEqual(['new mapbox-gl Map without performanceMetricsCollection: false'])
    expect(reasons(`import { Map as GlMap } from 'mapbox-gl'\nnew GlMap({ container: 'x' })`)).toHaveLength(1)
    expect(reasons(`import mapboxgl from 'mapbox-gl'\nnew mapboxgl.Map({ container: 'x', performanceMetricsCollection: false })`)).toEqual([])
  })

  it('flags a dynamic import of a map library', () => {
    expect(reasons(`const m = await import('mapbox-gl')`)).toHaveLength(1)
  })

  it('ignores Marker-only imports and comments', () => {
    expect(scan(`import { Marker } from 'react-map-gl/mapbox'\n// <Map />\nconst A = () => <Marker />`).uses).toEqual([])
  })

  // Bypass shapes from the PR-0 re-review: each must produce a violation.
  const REF = 'Map binding referenced outside a checked JSX tag / new expression'
  it.each([
    ['named re-export', `export { default as AppMap } from 'react-map-gl/mapbox'`, 're-export of a map library (its Map would escape this check)'],
    ['export *', `export * from "react-map-gl/mapbox"`, 're-export of a map library (its Map would escape this check)'],
    ['export * as ns', `export * as gl from 'mapbox-gl'`, 're-export of a map library (its Map would escape this check)'],
    ['require()', `const { Map } = require('react-map-gl/mapbox')\nconst A = () => <Map />`, 'require() of a map library (not statically checkable)'],
    ['const alias of the component', `import Map from 'react-map-gl/mapbox'\nexport const AppMap = Map`, REF],
    ['namespace member alias', `import * as ns from 'react-map-gl/mapbox'\nconst M = ns.Map\nconst A = () => <M />`, REF],
    ['React.createElement', `import Map from 'react-map-gl/mapbox'\nconst A = () => React.createElement(Map, { mapStyle: 's' })`, REF],
    ['local object namespace', `import Map from 'react-map-gl/mapbox'\nconst ns = { Map }\nconst A = () => <ns.Map />`, REF],
    ['mapbox-gl class alias', `import mapboxgl from 'mapbox-gl'\nconst C = mapboxgl.Map\nnew C({ container: 'x' })`, REF],
    ['mapbox-gl object passed on', `import mapboxgl from 'mapbox-gl'\nexport const gl = mapboxgl`, REF],
  ])('flags %s', (_label, src, reason) => {
    expect(reasons(src)).toContain(reason)
  })

  it('checks a spaced JSX member tag `<ns . Map />`', () => {
    expect(reasons(`import * as ns from 'react-map-gl/mapbox'\nconst A = () => <ns . Map />`)).toEqual(['missing performanceMetricsCollection={false}'])
    expect(reasons(`import * as ns from 'react-map-gl/mapbox'\nconst A = () => <ns . Map performanceMetricsCollection={false} />`)).toEqual([])
  })

  it('does not flag JSX text, strings, or non-Map members', () => {
    const src = `import Map, { Marker } from 'react-map-gl/mapbox'
import mapboxgl from 'mapbox-gl'
mapboxgl.accessToken = 'x'
const label = 'Map view'
export const A = () => (
  <div>
    <p>Map unavailable</p>
    <Map performanceMetricsCollection={false}>
      <Marker />
    </Map>
  </div>
)`
    expect(reasons(src)).toEqual([])
  })
})

