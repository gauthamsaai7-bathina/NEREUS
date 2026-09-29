# Jury demo script (about 5 minutes)

Login: `operator@nereus.demo` / `nereus2026` (UI-only demo sign-in).

1. **Login** - click "Fill demo credentials", then Sign in. Point out the DEMO MODE badge (from the live health endpoint).
2. **Overview** - empty on a fresh install because every number comes from stored scans. Click New analysis.
3. **Sonar Analysis** - click *Load Demo Scan* (synthetic), then **Analyze**. Narrate the stages: ingesting, preprocessing (contrast, speckle), inference, filtering natural features, geo data.
4. Click a box (or a table row): the inspector shows ID, class, score, size, coordinates (DEMO COORDINATES), and the evidence behind the score. Toggle Original/Enhanced, labels and segmentation; zoom and pan.
5. **Anomaly Map** - markers coloured by confidence, popups, class filters.
6. **Reports** - download JSON and CSV; show the printable view and the list of filtered false positives.
7. **History** - search, sort, open the scan again.
8. **System Health** - live component checks and latency.
9. **Live Detection** - clearly labelled simulation replaying the stored scan.

Honest framing: the bundled detector is classical computer vision on synthetic imagery; the value shown is the complete, replaceable pipeline.
