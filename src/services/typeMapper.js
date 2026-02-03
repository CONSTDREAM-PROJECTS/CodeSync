// Type Mapper Service - Maps UML types to language-specific types
class TypeMapper {
  
  static mapType(umlType, targetLanguage) {
    const typeMappings = {
      Java: {
        'String': 'String',
        'Integer': 'int',
        'Double': 'double',
        'Boolean': 'boolean',
        'Float': 'float',
        'Long': 'long',
        'Character': 'char',
        'Byte': 'byte',
        'Short': 'short',
        'List': 'List<Object>',
        'ArrayList': 'ArrayList<Object>',
        'Map': 'Map<String, Object>',
        'HashMap': 'HashMap<String, Object>',
        'Set': 'Set<Object>',
        'Date': 'Date',
        'LocalDateTime': 'LocalDateTime'
      },
      Python: {
        'String': 'str',
        'Integer': 'int',
        'Double': 'float',
        'Boolean': 'bool',
        'Float': 'float',
        'Long': 'int',
        'Character': 'str',
        'Byte': 'bytes',
        'List': 'list',
        'ArrayList': 'list',
        'Map': 'dict',
        'HashMap': 'dict',
        'Set': 'set',
        'Date': 'datetime',
        'LocalDateTime': 'datetime'
      },
      JavaScript: {
        'String': 'string',
        'Integer': 'number',
        'Double': 'number',
        'Boolean': 'boolean',
        'Float': 'number',
        'Long': 'number',
        'Character': 'string',
        'Byte': 'number',
        'List': 'Array',
        'ArrayList': 'Array',
        'Map': 'Object',
        'HashMap': 'Map',
        'Set': 'Set',
        'Date': 'Date',
        'LocalDateTime': 'Date'
      },
      'C++': {
        'String': 'std::string',
        'Integer': 'int',
        'Double': 'double',
        'Boolean': 'bool',
        'Float': 'float',
        'Long': 'long',
        'Character': 'char',
        'Byte': 'char',
        'List': 'std::vector<T>',
        'ArrayList': 'std::vector<T>',
        'Map': 'std::map<K, V>',
        'HashMap': 'std::unordered_map<K, V>',
        'Set': 'std::set<T>',
        'Date': 'std::chrono::system_clock::time_point'
      },
      'C#': {
        'String': 'string',
        'Integer': 'int',
        'Double': 'double',
        'Boolean': 'bool',
        'Float': 'float',
        'Long': 'long',
        'Character': 'char',
        'Byte': 'byte',
        'List': 'List<object>',
        'ArrayList': 'List<object>',
        'Map': 'Dictionary<string, object>',
        'HashMap': 'Dictionary<string, object>',
        'Set': 'HashSet<object>',
        'Date': 'DateTime',
        'LocalDateTime': 'DateTime'
      }
    };

    const languageMap = typeMappings[targetLanguage];
    if (!languageMap) return umlType || 'Object';
    
    return languageMap[umlType] || umlType || 'Object';
  }

  static getDefaultValue(type, language) {
    const defaults = {
      Java: {
        'int': '0',
        'double': '0.0',
        'float': '0.0f',
        'boolean': 'false',
        'long': '0L',
        'char': "'\\0'",
        'byte': '0',
        'short': '0',
        'String': 'null',
        'Object': 'null'
      },
      Python: {
        'int': '0',
        'float': '0.0',
        'bool': 'False',
        'str': '""',
        'list': '[]',
        'dict': '{}',
        'set': 'set()',
        'None': 'None'
      },
      JavaScript: {
        'number': '0',
        'string': '""',
        'boolean': 'false',
        'Array': '[]',
        'Object': '{}',
        'null': 'null',
        'undefined': 'undefined'
      },
      'C++': {
        'int': '0',
        'double': '0.0',
        'float': '0.0f',
        'bool': 'false',
        'char': "'\\0'",
        'std::string': '""'
      },
      'C#': {
        'int': '0',
        'double': '0.0',
        'float': '0.0f',
        'bool': 'false',
        'char': "'\\0'",
        'string': 'null',
        'object': 'null'
      }
    };

    const languageDefaults = defaults[language];
    if (!languageDefaults) return 'null';
    
    return languageDefaults[type] || 'null';
  }

  static inferTypeFromValue(value) {
    if (typeof value === 'string') return 'String';
    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'Integer' : 'Double';
    }
    if (typeof value === 'boolean') return 'Boolean';
    if (Array.isArray(value)) return 'List';
    if (value instanceof Date) return 'Date';
    if (typeof value === 'object') return 'Map';
    return 'Object';
  }

  static getCollectionType(baseType, language) {
    const collections = {
      Java: `List<${baseType}>`,
      Python: `List[${baseType}]`,
      JavaScript: `Array<${baseType}>`,
      'C++': `std::vector<${baseType}>`,
      'C#': `List<${baseType}>`
    };

    return collections[language] || `List<${baseType}>`;
  }
}

export default TypeMapper;