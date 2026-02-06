ATL / QVTo Integration — Instructions (prototype)

This project includes a small prototype pipeline to integrate ATL/QVTo transformations.

What you need to run ATL/QVTo:
- A full Eclipse installation with EMF and ATL/QVTo plugins (or the standalone ATL launcher).
- Knowledge of where your Eclipse installation is located.

Prototype usage:
1. Export your diagram JSON from the app (use app Export or save workspace) and place it at `tools/sample-model.json` (an example is included).
2. Run the XMI exporter to create `tools/sample-model.xmi`:

```bash
node tools/exportToXMI.js tools/sample-model.json tools/sample-model.xmi
```

3. Use Eclipse/ATL to run `atl/class2ast.atl` with `tools/sample-model.xmi` as input and an AST model as output. Exact commands depend on your ATL runner.

Notes:
- This is a scaffold. The ATL file is a skeleton showing how to implement rules. You will need to adapt the metamodels and XMI structure for a full conversion.
- For automation, you can call a headless Eclipse or an ATL command-line launcher from Node or a PowerShell script.
