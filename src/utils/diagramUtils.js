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

// Diagram types configuration - Limited to Class, Use Case, and Sequence diagrams
export const diagramTypes = [
  { id: 'class', name: 'Class Diagram', category: 'Structural' },
  { id: 'usecase', name: 'Use Case Diagram', category: 'Behavioral' },
  { id: 'sequence', name: 'Sequence Diagram', category: 'Behavioral' }
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
    usecase: [
      { id: 'actor', icon: '👤', label: 'Actor' },
      { id: 'usecase', icon: '⭕', label: 'Use Case' },
      { id: 'association', icon: '—', label: 'Association' },
      { id: 'include', icon: '«inc»', label: 'Include' },
      { id: 'extend', icon: '«ext»', label: 'Extend' },
      { id: 'generalization', icon: '△', label: 'Generalization' }
    ],
    sequence: [
      { id: 'lifeline', icon: '┃', label: 'Lifeline' },
      { id: 'message', icon: '→', label: 'Message' },
      { id: 'return', icon: '⟵', label: 'Return Message' },
      { id: 'activation', icon: '▮', label: 'Activation' },
      { id: 'fragment', icon: '▭', label: 'Fragment' }
    ]
  };

  return [...commonItems, ...(typeSpecificItems[diagramType] || [])];
};