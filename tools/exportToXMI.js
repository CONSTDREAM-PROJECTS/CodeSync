/*
Simple UML JSON -> minimal XMI exporter (prototype)
Usage:
  node tools/exportToXMI.js path/to/model.json path/to/output.xmi

model.json should be the diagram export (elements, connections). This exporter produces a minimal XMI-like UML file suitable for prototyping ATL transforms.
*/
const fs = require('fs');
const path = require('path');

function escapeXml(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}

function toXMI(model){
  const id = (v)=> 'id-'+(v||Math.floor(Math.random()*1000000));
  let xml = '';
  xml += '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<xmi:XMI xmlns:xmi="http://www.omg.org/XMI" xmlns:uml="http://www.omg.org/spec/UML/20131001">\n';
  xml += '  <uml:Model xmi:id="'+id('model')+'" name="ExportedModel">\n';

  (model.elements||[]).forEach(el=>{
    if(el.type === 'class' || el.type === 'abstract' || el.type === 'interface'){
      xml += `    <packagedElement xmi:type="uml:Class" xmi:id="${id(el.id)}" name="${escapeXml(el.name||'Class')}">\n`;
      (el.attributes||[]).forEach(attr=>{
        xml += `      <ownedAttribute xmi:id="${id(attr.name)}" name="${escapeXml(attr.name||'attr')}" type="${escapeXml(attr.type||'String')}"/>\n`;
      });
      xml += '    </packagedElement>\n';
    } else if(el.type === 'object'){
      xml += `    <packagedElement xmi:type="uml:InstanceSpecification" xmi:id="${id(el.id)}" name="${escapeXml(el.name||'object')}">\n`;
      if(el.className) xml += `      <classifier href="#${escapeXml(el.className)}"/>\n`;
      xml += '    </packagedElement>\n';
    }
  });

  xml += '  </uml:Model>\n';
  xml += '</xmi:XMI>\n';
  return xml;
}

const argv = process.argv.slice(2);
if(argv.length < 2){
  console.error('Usage: node tools/exportToXMI.js model.json output.xmi');
  process.exit(2);
}

const modelPath = path.resolve(argv[0]);
const outPath = path.resolve(argv[1]);

if(!fs.existsSync(modelPath)){
  console.error('Model file not found:', modelPath);
  process.exit(2);
}

const model = JSON.parse(fs.readFileSync(modelPath,'utf8'));
const xmi = toXMI(model);
fs.writeFileSync(outPath,xmi,'utf8');
console.log('Wrote XMI to', outPath);
