// Element calculation utilities
export const calculateElementHeight = (element) => {
  const baseHeight = 60;
  const attrCount = element.attributes?.length || 0;
  const methodCount = element.methods?.length || 0;
  const attrHeight = attrCount * 18;
  const methodHeight = methodCount * 18;
  const padding = (attrCount > 0 || methodCount > 0) ? 30 : 0;
  const stereotypeHeight = element.stereotype ? 20 : 0;

  return Math.max(100, baseHeight + stereotypeHeight + attrHeight + methodHeight + padding);
};

// Diagram types configuration
export const diagramTypes = [
  { id: 'class', name: 'Class Diagram', category: 'Structural' },
  { id: 'object', name: 'Object Diagram', category: 'Structural' },
  { id: 'component', name: 'Component Diagram', category: 'Structural' },
  { id: 'deployment', name: 'Deployment Diagram', category: 'Structural' },
  { id: 'package', name: 'Package Diagram', category: 'Structural' },
  { id: 'composite', name: 'Composite Structure Diagram', category: 'Structural' },
  { id: 'profile', name: 'Profile Diagram', category: 'Structural' },
  { id: 'usecase', name: 'Use Case Diagram', category: 'Behavioral' },
  { id: 'activity', name: 'Activity Diagram', category: 'Behavioral' },
  { id: 'state', name: 'State Machine Diagram', category: 'Behavioral' },
  { id: 'sequence', name: 'Sequence Diagram', category: 'Behavioral' },
  { id: 'communication', name: 'Communication Diagram', category: 'Behavioral' },
  { id: 'interaction', name: 'Interaction Overview Diagram', category: 'Behavioral' },
  { id: 'timing', name: 'Timing Diagram', category: 'Behavioral' }
];

// Toolbar items for each diagram type
export const getToolbarItems = (diagramType) => {
  const commonItems = [
    { id: 'select', icon: '⬚', label: 'Select' },
    { id: 'delete', icon: '🗑', label: 'Delete' }
  ];

  const typeSpecificItems = {
    class: [
      { id: 'class', icon: '📦', label: 'Class' },
      { id: 'interface', icon: '🔌', label: 'Interface' },
      { id: 'abstract', icon: '📋', label: 'Abstract Class' },
      { id: 'association', icon: '—', label: 'Association' },
      { id: 'inheritance', icon: '△', label: 'Inheritance' },
      { id: 'aggregation', icon: '◇', label: 'Aggregation' },
      { id: 'composition', icon: '◆', label: 'Composition' },
      { id: 'dependency', icon: '⟶', label: 'Dependency' }
    ],
    object: [
      { id: 'object', icon: '📄', label: 'Object' },
      { id: 'link', icon: '—', label: 'Link' }
    ],
    component: [
      { id: 'component', icon: '⚙️', label: 'Component' },
      { id: 'interface', icon: '🔌', label: 'Interface' },
      { id: 'dependency', icon: '⟶', label: 'Dependency' }
    ],
    deployment: [
      { id: 'node', icon: '🖥', label: 'Node' },
      { id: 'artifact', icon: '📦', label: 'Artifact' },
      { id: 'connection', icon: '—', label: 'Connection' }
    ],
    package: [
      { id: 'package', icon: '📁', label: 'Package' },
      { id: 'dependency', icon: '⟶', label: 'Dependency' },
      { id: 'import', icon: '↓', label: 'Import' }
    ],
    composite: [
      { id: 'class', icon: '📦', label: 'Class' },
      { id: 'part', icon: '⬚', label: 'Part' },
      { id: 'port', icon: '⬜', label: 'Port' },
      { id: 'connector', icon: '—', label: 'Connector' }
    ],
    profile: [
      { id: 'stereotype', icon: '《》', label: 'Stereotype' },
      { id: 'extension', icon: '⟶', label: 'Extension' }
    ],
    usecase: [
      { id: 'actor', icon: '👤', label: 'Actor' },
      { id: 'usecase', icon: '⭕', label: 'Use Case' },
      { id: 'association', icon: '—', label: 'Association' },
      { id: 'include', icon: '«inc»', label: 'Include' },
      { id: 'extend', icon: '«ext»', label: 'Extend' },
      { id: 'generalization', icon: '△', label: 'Generalization' }
    ],
    activity: [
      { id: 'initial', icon: '●', label: 'Initial Node' },
      { id: 'action', icon: '▭', label: 'Action' },
      { id: 'decision', icon: '◇', label: 'Decision' },
      { id: 'merge', icon: '◇', label: 'Merge' },
      { id: 'fork', icon: '▬', label: 'Fork' },
      { id: 'join', icon: '▬', label: 'Join' },
      { id: 'final', icon: '◉', label: 'Final Node' },
      { id: 'flow', icon: '→', label: 'Control Flow' }
    ],
    state: [
      { id: 'initial', icon: '●', label: 'Initial State' },
      { id: 'state', icon: '▭', label: 'State' },
      { id: 'final', icon: '◉', label: 'Final State' },
      { id: 'transition', icon: '→', label: 'Transition' },
      { id: 'choice', icon: '◇', label: 'Choice' }
    ],
    sequence: [
      { id: 'lifeline', icon: '│', label: 'Lifeline' },
      { id: 'message', icon: '→', label: 'Message' },
      { id: 'return', icon: '⟵', label: 'Return Message' },
      { id: 'activation', icon: '▮', label: 'Activation' },
      { id: 'fragment', icon: '▭', label: 'Fragment' }
    ],
    communication: [
      { id: 'object', icon: '📄', label: 'Object' },
      { id: 'message', icon: '→', label: 'Message' },
      { id: 'link', icon: '—', label: 'Link' }
    ],
    interaction: [
      { id: 'interaction', icon: '⬚', label: 'Interaction' },
      { id: 'flow', icon: '→', label: 'Flow' },
      { id: 'decision', icon: '◇', label: 'Decision' }
    ],
    timing: [
      { id: 'lifeline', icon: '│', label: 'Lifeline' },
      { id: 'state', icon: '▭', label: 'State' },
      { id: 'constraint', icon: '{  }', label: 'Time Constraint' }
    ]
  };

  return [...commonItems, ...(typeSpecificItems[diagramType] || [])];
};