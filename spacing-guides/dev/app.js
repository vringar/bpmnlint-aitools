import BpmnModeler from 'bpmn-js/lib/Modeler';

import SpacingGuidesModule from '../lib/SpacingGuidesModule';
import diagramXML from './diagram.bpmn';

const modeler = new BpmnModeler({
  container: '#canvas',
  additionalModules: [SpacingGuidesModule]
});

modeler.importXML(diagramXML).catch((err) => {
  console.error('failed to render diagram', err);
});

window.__modeler = modeler;
