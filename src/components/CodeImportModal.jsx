import React, { useState, useRef, useCallback } from 'react';
import { Upload, AlertCircle, CheckCircle, FileCode } from 'lucide-react';
import CodeToUMLConverter from '../services/codeToUMLConverter';

// ── Per-diagram-type, per-language example snippets ───────────────────────────
const EXAMPLE_CODE = {

  // ── CLASS DIAGRAM ──────────────────────────────────────────────────────────
  class: {
    Java: `public class Animal {
  private String name;
  private int age;

  public Animal(String name, int age) {
    this.name = name;
    this.age = age;
  }

  public String getName() { return name; }
  public void makeSound() {}
}

public class Dog extends Animal {
  private String breed;

  public Dog(String name, int age, String breed) {
    super(name, age);
    this.breed = breed;
  }

  @Override
  public void makeSound() {
    System.out.println("Woof!");
  }
}

public interface Trainable {
  void train(String command);
  boolean isTrained();
}`,

    Python: `class Animal:
    def __init__(self, name: str, age: int):
        self.name = name
        self.age = age

    def make_sound(self):
        pass


class Dog(Animal):
    def __init__(self, name: str, age: int, breed: str):
        super().__init__(name, age)
        self.breed = breed

    def make_sound(self):
        print("Woof!")


class Cat(Animal):
    def __init__(self, name: str, age: int):
        super().__init__(name, age)

    def make_sound(self):
        print("Meow!")`,

    JavaScript: `class Animal {
  constructor(name, age) {
    this.name = name;
    this.age = age;
  }

  makeSound() {}
}

class Dog extends Animal {
  constructor(name, age, breed) {
    super(name, age);
    this.breed = breed;
  }

  makeSound() {
    console.log("Woof!");
  }
}

class Cat extends Animal {
  constructor(name, age) {
    super(name, age);
  }

  makeSound() {
    console.log("Meow!");
  }
}`,
  },

  // ── USE CASE DIAGRAM ───────────────────────────────────────────────────────
  // Uses @Actor / @UseCase / @Association / @Includes / @Extends annotations.
  // The converter detects these and routes to parseAnnotatedUseCaseAST().
  // Java/JS: annotations on real class files. Python: # prefix on a module.
  usecase: {
    Java: `// Online Banking System — Use Case Diagram
// Paste this into the converter while on the Use Case tab.

@Actor("Customer")
@Actor("Bank Admin")

@UseCase("Log In")
@UseCase("Check Balance")
@UseCase("Transfer Funds")
@UseCase("View Transaction History")
@UseCase("Manage Account")
@UseCase("Verify Identity")

@Association("Customer", "Log In")
@Association("Customer", "Check Balance")
@Association("Customer", "Transfer Funds")
@Association("Customer", "View Transaction History")
@Association("Bank Admin", "View Transaction History")
@Association("Bank Admin", "Manage Account")

@Includes("Transfer Funds", "Verify Identity")
@Includes("Log In", "Verify Identity")

public class OnlineBankingSystem {

    public void login(String username, String password) {
        verifyIdentity(username, password);
    }

    public double checkBalance(String accountId) {
        return 0.0;
    }

    public boolean transferFunds(String from, String to, double amount) {
        verifyIdentity(from, null);
        return true;
    }

    public void viewTransactionHistory(String accountId) {}

    public void manageAccount(String accountId) {}

    private boolean verifyIdentity(String user, String pass) {
        return true;
    }
}`,

    Python: `# Online Shopping System — Use Case Diagram
# Paste this into the converter while on the Use Case tab.

# @Actor("Customer")
# @Actor("Admin")

# @UseCase("Browse Products")
# @UseCase("Add to Cart")
# @UseCase("Checkout")
# @UseCase("Track Order")
# @UseCase("Process Payment")
# @UseCase("Manage Inventory")

# @Association("Customer", "Browse Products")
# @Association("Customer", "Add to Cart")
# @Association("Customer", "Checkout")
# @Association("Customer", "Track Order")
# @Association("Admin", "Manage Inventory")
# @Association("Admin", "Track Order")

# @Includes("Checkout", "Process Payment")

class OnlineShoppingSystem:
    def browse_products(self):
        return []

    def add_to_cart(self, product_id: str, quantity: int):
        pass

    def checkout(self, cart_id: str):
        self.process_payment(cart_id)

    def track_order(self, order_id: str):
        return {}

    def process_payment(self, cart_id: str):
        return True

    def manage_inventory(self, product_id: str, stock: int):
        pass`,

    JavaScript: `// Task Management App — Use Case Diagram
// Paste this into the converter while on the Use Case tab.

// @Actor("User")
// @Actor("Manager")

// @UseCase("Create Task")
// @UseCase("Assign Task")
// @UseCase("Update Status")
// @UseCase("View Dashboard")
// @UseCase("Generate Report")
// @UseCase("Send Notification")

// @Association("User", "Create Task")
// @Association("User", "Update Status")
// @Association("User", "View Dashboard")
// @Association("Manager", "Assign Task")
// @Association("Manager", "View Dashboard")
// @Association("Manager", "Generate Report")

// @Includes("Assign Task", "Send Notification")
// @Includes("Update Status", "Send Notification")

class TaskManagementApp {
  createTask(title, description) {
    this.sendNotification("Task created: " + title);
  }

  assignTask(taskId, userId) {
    this.sendNotification("Task assigned to " + userId);
  }

  updateStatus(taskId, status) {
    this.sendNotification("Status updated: " + status);
  }

  viewDashboard(userId) {
    return [];
  }

  generateReport(startDate, endDate) {
    return {};
  }

  sendNotification(message) {
    console.log(message);
  }
}`,
  },

  // ── SEQUENCE DIAGRAM ───────────────────────────────────────────────────────
  // The converter's sequence parser detects class-to-class method calls via
  // stored field references (this.field.method() / self.field.method()).
  // Each class becomes a lifeline; calls between them become messages.
  sequence: {
    Java: `// User Login Flow — Sequence Diagram
// Each class becomes a lifeline. Method calls between classes become messages.

public class LoginPage {
  private AuthService authService;
  private UserSession userSession;

  public LoginPage(AuthService authService, UserSession userSession) {
    this.authService = authService;
    this.userSession = userSession;
  }

  public void submitLogin(String username, String password) {
    String token = authService.authenticate(username, password);
    if (token != null) {
      userSession.startSession(token);
    }
  }
}

public class AuthService {
  private UserRepository userRepository;

  public AuthService(UserRepository userRepository) {
    this.userRepository = userRepository;
  }

  public String authenticate(String username, String password) {
    boolean valid = userRepository.validateCredentials(username, password);
    return valid ? "token_abc" : null;
  }
}

public class UserRepository {
  public boolean validateCredentials(String username, String password) {
    return true;
  }
}

public class UserSession {
  public void startSession(String token) {
    System.out.println("Session started: " + token);
  }
}`,

    Python: `# E-Commerce Order Flow — Sequence Diagram
# Each class becomes a lifeline. self.field.method() calls become messages.

class OrderController:
    def __init__(self, inventory: InventoryService, payment: PaymentService):
        self.inventory = inventory
        self.payment = payment

    def place_order(self, product_id: str, quantity: int, card: str):
        available = self.inventory.check_stock(product_id, quantity)
        if available:
            confirmed = self.payment.charge(card, quantity * 10.0)
            if confirmed:
                self.inventory.reserve(product_id, quantity)


class InventoryService:
    def check_stock(self, product_id: str, quantity: int):
        return True

    def reserve(self, product_id: str, quantity: int):
        pass


class PaymentService:
    def charge(self, card: str, amount: float):
        return True`,

    JavaScript: `// API Request Flow — Sequence Diagram
// Each class becomes a lifeline. this.field.method() calls become messages.

class ApiController {
  constructor(authMiddleware, userService, responseHandler) {
    this.authMiddleware = authMiddleware;
    this.userService = userService;
    this.responseHandler = responseHandler;
  }

  handleRequest(token, userId) {
    const valid = this.authMiddleware.validateToken(token);
    if (valid) {
      const user = this.userService.findById(userId);
      this.responseHandler.send(user);
    }
  }
}

class AuthMiddleware {
  constructor(tokenStore) {
    this.tokenStore = tokenStore;
  }

  validateToken(token) {
    return this.tokenStore.lookup(token);
  }
}

class TokenStore {
  lookup(token) {
    return token != null;
  }
}

class UserService {
  findById(userId) {
    return { id: userId, name: "Alice" };
  }
}

class ResponseHandler {
  send(data) {
    console.log(data);
  }
}`,
  },
};

const CodeImportModal = ({ onImport, onClose, diagramType = 'class' }) => {
  const [sourceCode,       setSourceCode]       = useState('');
  const [language,         setLanguage]         = useState('Java');
  const [conversionResult, setConversionResult] = useState(null);
  const [isConverting,     setIsConverting]     = useState(false);
  const [isDragging,       setIsDragging]       = useState(false); // drag-over state
  const [droppedFileName,  setDroppedFileName]  = useState('');    // show which file was dropped
  const fileInputRef = useRef(null);
  const dragCounterRef = useRef(0); // counts enter/leave pairs to avoid flicker

  // ── Language detection from file extension ──────────────────────────────
  const detectLanguage = (fileName) => {
    const f = fileName.toLowerCase();
    if (f.endsWith('.java'))                         return 'Java';
    if (f.endsWith('.py'))                           return 'Python';
    if (f.endsWith('.js') || f.endsWith('.jsx'))    return 'JavaScript';
    return null; // unknown — keep current selection
  };

  // ── Shared file reader ───────────────────────────────────────────────────
  const readFile = useCallback((file) => {
    if (!file) return;
    const detected = detectLanguage(file.name);
    if (detected) setLanguage(detected);
    setDroppedFileName(file.name);
    setConversionResult(null);

    const reader = new FileReader();
    reader.onload = (e) => setSourceCode(e.target.result);
    reader.readAsText(file);
  }, []);

  // ── Click-to-upload handler ──────────────────────────────────────────────
  const handleFileUpload = (event) => {
    readFile(event.target.files[0]);
    // Reset so the same file can be re-uploaded
    event.target.value = '';
  };

  // ── Drag-and-drop handlers ───────────────────────────────────────────────
  // dragCounterRef prevents the drop zone from flickering when the cursor
  // moves over a child element (which fires dragLeave then dragEnter).

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    // Tell the browser to show a "copy" cursor
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      // Only read the first file if multiple were dropped
      readFile(files[0]);
    }
  }, [readFile]);

  // ── Convert handler ──────────────────────────────────────────────────────
  const inferDiagramType = (code, result) => {
    const metadataType = result?.metadata?.diagramType;
    if (['class', 'usecase', 'sequence'].includes(metadataType)) {
      return metadataType;
    }

    if (result?.elements?.some(el => el.diagramType === 'usecase' || el.type === 'actor' || el.type === 'usecase')) {
      return 'usecase';
    }

    if (result?.elements?.some(el => el.diagramType === 'sequence' || el.type === 'lifeline')) {
      return 'sequence';
    }

    if (/@Actor\s*\(|@UseCase\s*\(|@Association\s*\(|@Includes\s*\(|@Extends\s*\(/.test(code)) {
      return 'usecase';
    }

    if (/\b(sequenceDiagram|participant|activate|deactivate)\b/i.test(code) || /[A-Za-z0-9_]+\s*[-=]+>>?\s*[A-Za-z0-9_]+/.test(code)) {
      return 'sequence';
    }

    return ['class', 'usecase', 'sequence'].includes(diagramType) ? diagramType : 'class';
  };

  const handleConvert = async () => {
    if (!sourceCode.trim()) {
      setConversionResult({ success: false, message: 'Please paste or drop some source code first.' });
      return;
    }
    setIsConverting(true);
    const hasUseCaseAnnotations = /@Actor\s*\(|@UseCase\s*\(|@Association\s*\(|@Includes\s*\(|@Extends\s*\(/.test(sourceCode);
    const isUseCaseMode = diagramType === 'usecase' && !hasUseCaseAnnotations;
    const isSequenceMode = diagramType === 'sequence';
    const result = isSequenceMode
      ? CodeToUMLConverter.convertCodeToUMLSequence(sourceCode, language)
      : isUseCaseMode
        ? CodeToUMLConverter.convertCodeToUMLUseCase(sourceCode, language)
        : CodeToUMLConverter.convertCodeToUML(sourceCode, language);
    const detectedDiagramType = inferDiagramType(sourceCode, result);
    setConversionResult({
      ...result,
      metadata: {
        ...(result.metadata || {}),
        sourceLanguage: result.metadata?.sourceLanguage || language,
        diagramType: detectedDiagramType,
      },
    });
    setIsConverting(false);
  };

  const handleImportDiagram = () => {
    if (conversionResult?.success) {
      // FIX: pass the full result so UMLEditor can honour replaceAll and
      // auto-switch the diagram type (e.g. class → sequence) when needed.
      onImport(
        conversionResult.elements,
        conversionResult.connections,
        {
          replaceAll:  conversionResult.replaceAll  || false,
          // Use the diagramType the converter detected (usecase / sequence / class).
          // Fall back to the currently active diagram type if not provided.
          diagramType: conversionResult.metadata?.diagramType || diagramType,
          language:    conversionResult.metadata?.sourceLanguage || language,
        }
      );
      onClose();
    }
  };

  const handleClear = () => {
    setSourceCode('');
    setConversionResult(null);
    setDroppedFileName('');
  };

  const handleLoadExample = () => {
    // Pick the right bucket based on which diagram tab is active
    const typeKey = ['usecase', 'sequence'].includes(diagramType) ? diagramType : 'class';
    const byType  = EXAMPLE_CODE[typeKey] || EXAMPLE_CODE.class;
    const example = byType[language] || byType.Java;
    setSourceCode(example);
    setDroppedFileName('');
    setConversionResult(null);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="bg-[#252526] border border-[#3e3e42] rounded-lg max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        // Attach drag events to the whole modal so the user can drop
        // anywhere inside it, not just on the textarea.
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="p-6 border-b border-[#3e3e42]">
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <Upload size={20} />
            <span>Code to UML Conversion</span>
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Paste, upload, or <span className="text-[#007acc] font-medium">drag & drop</span> a code
            file to automatically generate UML diagrams using Rule-Based Model Transformation.
          </p>
        </div>

        <div className="p-6 space-y-4">

          {/* ── Language Selector ─────────────────────────────────────────── */}
          <div>
            <label className="text-sm font-semibold text-gray-300 block mb-2">
              Programming Language / Format
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              disabled={isConverting}
              className="w-full bg-[#3c3c3c] text-white px-3 py-2 rounded border border-[#3e3e42] focus:outline-none focus:border-[#007acc] disabled:opacity-50"
            >
              <option value="Java">Java</option>
              <option value="Python">Python</option>
              <option value="JavaScript">JavaScript</option>
            </select>
          </div>

          {/* ── Drag & Drop Zone ─────────────────────────────────────────── */}
          {/* This is the primary drop target with visual feedback.
              The textarea below is a secondary drop target for convenience. */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-gray-300">
                Source Code or Diagram Definition
              </label>
              <button
                onClick={handleLoadExample}
                disabled={isConverting}
                className="text-xs px-2.5 py-1 rounded bg-[#3c3c3c] hover:bg-[#4a4a4f] text-[#9cdcfe] hover:text-white border border-[#3e3e42] transition-colors disabled:opacity-50"
                title="Fill the editor with a working example for the selected language"
              >
                Load Example
              </button>
            </div>

            {/* Drop zone overlay — shown when a file is being dragged */}
            <div className="relative">
              <textarea
                value={sourceCode}
                onChange={(e) => { setSourceCode(e.target.value); setDroppedFileName(''); }}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                placeholder={
                  diagramType === 'usecase'
                    ? 'Paste annotated use case code here, or click Load Example...'
                    : diagramType === 'sequence'
                    ? 'Paste class code with method calls here, or click Load Example...'
                    : `Drop a .${language === 'Java' ? 'java' : language === 'Python' ? 'py' : 'js'} file here, or paste your source code...`
                }
                disabled={isConverting}
                className={`w-full h-64 bg-[#1e1e1e] text-white px-3 py-2 rounded border font-mono text-sm
                  focus:outline-none resize-none disabled:opacity-50 transition-colors
                  ${isDragging
                    ? 'border-[#007acc] bg-[#1a2a3a]'
                    : 'border-[#3e3e42] focus:border-[#007acc]'
                  }`}
              />

              {/* Drag overlay — appears on top of textarea while dragging */}
              {isDragging && (
                <div className="absolute inset-0 rounded border-2 border-dashed border-[#007acc] bg-[#1a2a3a] bg-opacity-90 flex flex-col items-center justify-center pointer-events-none">
                  <FileCode size={40} className="text-[#007acc] mb-3" />
                  <p className="text-[#007acc] font-semibold text-lg">Drop your file here</p>
                  <p className="text-gray-400 text-sm mt-1">
                    Supports .java · .py · .js · .jsx
                  </p>
                </div>
              )}
            </div>

            {/* File name badge — shows after a file is dropped or uploaded */}
            {droppedFileName && (
              <div className="flex items-center gap-2 mt-2 px-2 py-1 bg-[#1e3a1f] border border-green-700 rounded text-xs text-green-300">
                <FileCode size={12} />
                <span className="font-mono">{droppedFileName}</span>
                <span className="text-gray-400">loaded</span>
              </div>
            )}

            <p className="text-xs text-gray-400 mt-1">
              Supported: classes, attributes, methods, inheritance, interfaces, and composition
            </p>
          </div>

          {/* ── File Upload Button + Clear ────────────────────────────────── */}
          <div className="flex items-center gap-3">
            <label className="flex-1 cursor-pointer">
              <div className="bg-[#3c3c3c] hover:bg-[#4a4a4f] text-white px-4 py-2 rounded border border-[#3e3e42] transition-colors text-center text-sm">
                📁 Choose File (.java, .py, .js)
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".java,.py,.js,.jsx,.ts,.tsx"
                onChange={handleFileUpload}
                className="hidden"
                disabled={isConverting}
              />
            </label>

            {sourceCode && (
              <button
                onClick={handleClear}
                className="px-4 py-2 bg-[#4a4a4f] hover:bg-[#5a5a5f] text-white rounded transition-colors text-sm"
                title="Clear"
              >
                🗑️ Clear
              </button>
            )}
          </div>

          {/* ── Convert Button ────────────────────────────────────────────── */}
          <button
            onClick={handleConvert}
            disabled={!sourceCode.trim() || isConverting || !!conversionResult?.success}
            className="w-full bg-[#007acc] hover:bg-[#005a9e] disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded font-medium transition-colors"
          >
            {isConverting ? 'Converting...' : 'Convert to UML Diagram'}
          </button>

          {/* ── Conversion Result ─────────────────────────────────────────── */}
          {conversionResult && (
            <div className={`p-4 rounded-lg border-l-4 ${
              conversionResult.success
                ? 'bg-[#1e3a1f] border-green-500 text-green-100'
                : 'bg-[#3a1f1f] border-red-500 text-red-100'
            }`}>
              <div className="flex items-start space-x-3">
                {conversionResult.success
                  ? <CheckCircle size={20} className="flex-shrink-0 mt-0.5 text-green-400" />
                  : <AlertCircle size={20} className="flex-shrink-0 mt-0.5 text-red-400" />
                }
                <div className="flex-1">
                  <p className="font-semibold">{conversionResult.message}</p>

                  {conversionResult.metadata && (
                    <div className="text-sm mt-3 grid grid-cols-2 gap-2">
                      <div className="bg-black bg-opacity-30 px-2 py-1 rounded">
                        <span className="text-gray-300">Classes: </span>
                        <span className="font-mono">{conversionResult.metadata.totalClasses}</span>
                      </div>
                      <div className="bg-black bg-opacity-30 px-2 py-1 rounded">
                        <span className="text-gray-300">Methods: </span>
                        <span className="font-mono">{conversionResult.metadata.totalMethods}</span>
                      </div>
                      <div className="bg-black bg-opacity-30 px-2 py-1 rounded">
                        <span className="text-gray-300">Attributes: </span>
                        <span className="font-mono">{conversionResult.metadata.totalAttributes}</span>
                      </div>
                      <div className="bg-black bg-opacity-30 px-2 py-1 rounded">
                        <span className="text-gray-300">Relationships: </span>
                        <span className="font-mono">{conversionResult.metadata.relationships}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="p-4 border-t border-[#3e3e42] flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#3c3c3c] hover:bg-[#4a4a4f] text-white rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImportDiagram}
            disabled={!conversionResult?.success}
            className="px-4 py-2 bg-[#007acc] hover:bg-[#005a9e] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded font-medium transition-colors"
          >
            Import to Diagram
          </button>
        </div>
      </div>
    </div>
  );
};

export default CodeImportModal;
