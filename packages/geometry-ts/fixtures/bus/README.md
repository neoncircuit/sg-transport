# Bus geometry fixtures

Small **overlapping** BusStops + BusRoutes samples (Victoria St area) so
`pnpm extract:bus` can produce real LineStrings without a DataMall key or
full island dumps.

Used automatically when local `data/lta/` dumps yield 0 overlapping features
(common with single-page API samples).
