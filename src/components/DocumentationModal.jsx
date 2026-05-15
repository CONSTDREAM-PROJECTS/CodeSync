import React, { useState } from 'react';
import { X, BookOpen, GitBranch, Layers, MessageSquare, ChevronDown, ChevronRight, Code } from 'lucide-react';

// ─── Sample code snippets per language per diagram type ────────────────────────
const CODE_SAMPLES = {
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

class Trainable:
    def train(self, command: str):
        pass

    def is_trained(self) -> bool:
        pass`,
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
  usecase: {
    Java: `// Step 1: Paste the annotations into "Code to Diagram" to build the diagram.
// Step 2: Click "Generate Code" on the diagram to get runnable Java classes.

// @Actor("Customer")
// @Actor("Admin")

// @UseCase("Browse Products")
// @UseCase("Add to Cart")
// @UseCase("Checkout")
// @UseCase("Process Payment")
// @UseCase("Manage Inventory")
// @UseCase("View Reports")

// @Association("Customer", "Browse Products")
// @Association("Customer", "Add to Cart")
// @Association("Customer", "Checkout")
// @Association("Admin", "Manage Inventory")
// @Association("Admin", "View Reports")

// @Includes("Checkout", "Process Payment")

// ── Generated Code output (what you get after clicking Generate Code) ────────

// package com.example.usecases;
//
// public class UseCaseHandler {
//     public boolean executeProcessPayment() {
//         // TODO: implement "Process Payment"
//         return true;
//     }
// }
//
// public class Customer {
//     private final UseCaseHandler handler = new UseCaseHandler();
//
//     public boolean executeBrowseProducts() {
//         return true;
//     }
//     public boolean executeAddToCart() {
//         return true;
//     }
//     public boolean executeCheckout() {
//         handler.executeProcessPayment(); // <<include>>
//         return true;
//     }
// }
//
// public class Admin {
//     private final UseCaseHandler handler = new UseCaseHandler();
//
//     public boolean executeManageInventory() {
//         return true;
//     }
//     public boolean executeViewReports() {
//         return true;
//     }
// }
//
// public class UseCaseRunner {
//     public static void main(String[] args) {
//         Customer customer = new Customer();
//         System.out.println("Customer: Browse Products = " + customer.executeBrowseProducts());
//         System.out.println("Customer: Add to Cart = " + customer.executeAddToCart());
//         System.out.println("Customer: Checkout = " + customer.executeCheckout());
//         Admin admin = new Admin();
//         System.out.println("Admin: Manage Inventory = " + admin.executeManageInventory());
//         System.out.println("Admin: View Reports = " + admin.executeViewReports());
//     }
// }`,
    Python: `# Step 1: Paste the annotations into "Code to Diagram" to build the diagram.
# Step 2: Click "Generate Code" on the diagram to get runnable Python classes.

# @Actor("Customer")
# @Actor("Admin")

# @UseCase("Browse Products")
# @UseCase("Add to Cart")
# @UseCase("Checkout")
# @UseCase("Process Payment")
# @UseCase("Manage Inventory")
# @UseCase("View Reports")

# @Association("Customer", "Browse Products")
# @Association("Customer", "Add to Cart")
# @Association("Customer", "Checkout")
# @Association("Admin", "Manage Inventory")
# @Association("Admin", "View Reports")

# @Includes("Checkout", "Process Payment")

# ── Generated Code output (what you get after clicking Generate Code) ────────

# class UseCaseHandler:
#
#     def execute_process_payment(self) -> bool:
#         # TODO: implement "Process Payment"
#         return True
#
#
# class Customer:
#
#     def __init__(self):
#         self.handler = UseCaseHandler()
#
#     def execute_browse_products(self) -> bool:
#         return True
#
#     def execute_add_to_cart(self) -> bool:
#         return True
#
#     def execute_checkout(self) -> bool:
#         self.handler.execute_process_payment()  # <<include>>
#         return True
#
#
# class Admin:
#
#     def execute_manage_inventory(self) -> bool:
#         return True
#
#     def execute_view_reports(self) -> bool:
#         return True
#
#
# if __name__ == "__main__":
#     customer = Customer()
#     print("Customer: Browse Products =", customer.execute_browse_products())
#     print("Customer: Add to Cart =", customer.execute_add_to_cart())
#     print("Customer: Checkout =", customer.execute_checkout())
#     admin = Admin()
#     print("Admin: Manage Inventory =", admin.execute_manage_inventory())
#     print("Admin: View Reports =", admin.execute_view_reports())`,
    JavaScript: `// Step 1: Paste the annotations into "Code to Diagram" to build the diagram.
// Step 2: Click "Generate Code" on the diagram to get runnable JS classes.

// @Actor("Customer")
// @Actor("Admin")

// @UseCase("Browse Products")
// @UseCase("Add to Cart")
// @UseCase("Checkout")
// @UseCase("Process Payment")
// @UseCase("Manage Inventory")
// @UseCase("View Reports")

// @Association("Customer", "Browse Products")
// @Association("Customer", "Add to Cart")
// @Association("Customer", "Checkout")
// @Association("Admin", "Manage Inventory")
// @Association("Admin", "View Reports")

// @Includes("Checkout", "Process Payment")

// ── Generated Code output (what you get after clicking Generate Code) ────────

// class UseCaseHandler {
//     executeProcessPayment() {
//         // TODO: implement "Process Payment"
//         return true;
//     }
// }
//
// class Customer {
//     constructor() {
//         this.handler = new UseCaseHandler();
//     }
//     executeBrowseProducts() {
//         return true;
//     }
//     executeAddToCart() {
//         return true;
//     }
//     executeCheckout() {
//         this.handler.executeProcessPayment(); // <<include>>
//         return true;
//     }
// }
//
// class Admin {
//     executeManageInventory() {
//         return true;
//     }
//     executeViewReports() {
//         return true;
//     }
// }
//
// export { UseCaseHandler, Customer, Admin };
//
// // const customer = new Customer();
// // console.log("Customer: Browse Products =", customer.executeBrowseProducts());
// // console.log("Customer: Checkout =", customer.executeCheckout());
// // const admin = new Admin();
// // console.log("Admin: View Reports =", admin.executeViewReports());`,
  },

  sequence: {
    Java: `// Sequence: User login flow
// Participants: User -> LoginPage -> AuthService -> Database

public class LoginPage {
  private AuthService authService = new AuthService();

  public String handleLogin(String email, String password) {
    // LoginPage calls AuthService (message)
    String token = authService.validateUser(email, password);
    // AuthService returns token (return message)
    return token;
  }
}

public class AuthService {
  private Database database = new Database();

  public String validateUser(String email, String password) {
    // AuthService calls Database (message)
    User user = database.findUserByEmail(email);
    // Database returns user record (return message)
    if (user != null && user.checkPassword(password)) {
      return generateToken(user);
    }
    return null;
  }

  private String generateToken(User user) {
    return "jwt-token-" + user.getId();
  }
}

public class Database {
  public User findUserByEmail(String email) {
    // Simulates DB lookup
    return new User(1, email);
  }
}`,
    Python: `# Sequence: User login flow
# Participants: User -> LoginPage -> AuthService -> Database

class Database:
    def find_user_by_email(self, email: str):
        # Simulates DB lookup (return message back to AuthService)
        return {"id": 1, "email": email, "password_hash": "hashed"}


class AuthService:
    def __init__(self):
        self.database = Database()

    def validate_user(self, email: str, password: str):
        # AuthService sends message to Database
        user = self.database.find_user_by_email(email)
        # Database returns user record
        if user and password == "secret":
            return f"jwt-token-{user['id']}"
        return None


class LoginPage:
    def __init__(self):
        self.auth_service = AuthService()

    def handle_login(self, email: str, password: str):
        # LoginPage sends message to AuthService
        token = self.auth_service.validate_user(email, password)
        # AuthService returns token
        if token:
            print("Redirect to dashboard")
        return token`,
    JavaScript: `// Sequence: User login flow
// Participants: User -> LoginPage -> AuthService -> Database

class Database {
  findUserByEmail(email) {
    // Simulates DB lookup — return message back to AuthService
    return { id: 1, email, passwordHash: "hashed" };
  }
}

class AuthService {
  constructor() {
    this.database = new Database();
  }

  validateUser(email, password) {
    // AuthService sends message to Database
    const user = this.database.findUserByEmail(email);
    // Database returns user record
    if (user && password === "secret") {
      return \`jwt-token-\${user.id}\`;
    }
    return null;
  }
}

class LoginPage {
  constructor() {
    this.authService = new AuthService();
  }

  handleLogin(email, password) {
    // LoginPage sends message to AuthService
    const token = this.authService.validateUser(email, password);
    // AuthService returns token
    if (token) console.log("Redirect to dashboard");
    return token;
  }
}`,
  },
};

// ─── Diagram sections data ────────────────────────────────────────────────────
const DIAGRAMS = [
  {
    id: 'class',
    icon: <Layers size={18} />,
    label: 'Class Diagram',
    color: '#4ec9b0',
    what: `A class diagram maps out the building blocks of your software. Each box represents a class (a blueprint for objects), and the lines between them show how those classes relate to each other. This is the go-to diagram when you want to plan or document the structure of an object-oriented system.`,
    elements: [
      { name: 'Class', desc: 'A box with three sections: the class name on top, attributes (fields) in the middle, and methods (functions) at the bottom.' },
      { name: 'Interface', desc: 'Like a class, but it only defines what methods must exist, not how they work. Shown with the label <<interface>>.' },
      { name: 'Abstract Class', desc: 'A class that cannot be created directly, it exists to be extended by other classes. Shown in italics or labeled <<abstract>>.' },
      { name: 'Enum', desc: 'A fixed set of named values, like days of the week or status codes.' },
    ],
    relations: [
      { name: 'Association', arrow: 'A --> B', desc: 'A general "uses" or "knows about" relationship. Class A has a reference to Class B.' },
      { name: 'Inheritance', arrow: 'Dog --|> Animal', desc: 'Dog is a type of Animal. The child class gets everything the parent class has.' },
      { name: 'Realization', arrow: 'Dog ..|> Trainable', desc: 'Dog implements the Trainable interface, meaning it must provide the methods Trainable requires.' },
      { name: 'Aggregation', arrow: 'Team <>-- Player', desc: 'A Team has Players, but Players can exist without the Team. A "has-a" relationship where the parts survive the whole.' },
      { name: 'Composition', arrow: 'House *-- Room', desc: 'A House contains Rooms, and Rooms cannot exist without the House. Stronger than aggregation.' },
      { name: 'Dependency', arrow: 'A ..> B', desc: 'A temporarily uses B, usually as a method parameter or local variable, but does not hold a long-term reference.' },
    ],
    howToConnect: `Click a class on the canvas to select it, then hover until you see the blue connection dots appear on its edges. Click and drag from one of those dots to another class to draw a relationship. After drawing, select the line to change its type in the Properties panel on the right.`,
    codeNote: `Paste a Java, Python, or JavaScript file. The tool reads your class definitions, attributes, methods, and inheritance and builds the diagram automatically.`,
    sampleLangs: ['Java', 'Python', 'JavaScript'],
  },
  {
    id: 'usecase',
    icon: <GitBranch size={18} />,
    label: 'Use Case Diagram',
    color: '#9cdcfe',
    what: `A use case diagram answers one question: who does what in this system? It is a high-level picture meant for non-technical stakeholders. You show the people or systems that interact with your software (called actors) and the actions they can perform (called use cases).`,
    elements: [
      { name: 'Actor', desc: 'A stick figure representing a user, an organization, or another system that interacts with yours.' },
      { name: 'Use Case', desc: 'An oval representing something the system does for an actor, like "Place Order" or "Generate Report".' },
      { name: 'System Boundary', desc: 'A box that wraps all the use cases, showing what is inside your system versus outside it.' },
    ],
    relations: [
      { name: 'Association', arrow: 'Actor --> UseCase', desc: 'The actor participates in that use case.' },
      { name: 'Include', arrow: 'UC1 ..> UC2 : <<include>>', desc: 'UC1 always triggers UC2 as part of its flow, like "Checkout" always includes "Process Payment".' },
      { name: 'Extend', arrow: 'UC2 ..> UC1 : <<extend>>', desc: 'UC2 is an optional extra step that sometimes happens during UC1.' },
      { name: 'Generalization', arrow: 'Admin --|> User', desc: 'Admin is a specialized version of User and inherits their use cases.' },
    ],
    howToConnect: `Select an Actor or Use Case element, then drag from the blue dots on its border to another element. For include and extend relationships, draw the line and then change the type using the Properties panel.`,
    codeNote: `Each sample has two parts: the top half is the annotation code you paste into "Code to Diagram" to build the diagram. The bottom half (commented out) is what Generate Code produces from that diagram. Use @Actor for stick figures, @UseCase for ovals, @Association for connecting lines, @Includes for <<include>> arrows, and @Extends for <<extend>> arrows.`,
    sampleLangs: ['Java', 'Python', 'JavaScript'],
  },
  {
    id: 'sequence',
    icon: <MessageSquare size={18} />,
    label: 'Sequence Diagram',
    color: '#ce9178',
    what: `A sequence diagram shows how things talk to each other over time. Instead of showing structure, it shows a conversation, the step-by-step messages passed between objects or people to complete a specific task, like logging in or placing an order.`,
    elements: [
      { name: 'Lifeline', desc: 'A vertical dashed line with a named box on top, representing an object or participant in the conversation.' },
      { name: 'Activation Bar', desc: 'A thin rectangle on a lifeline showing when that participant is actively doing something.' },
      { name: 'Message', desc: 'A horizontal arrow from one lifeline to another, representing a method call or data being sent.' },
      { name: 'Return Message', desc: 'A dashed arrow going back in the opposite direction, showing a response or return value.' },
    ],
    relations: [
      { name: 'Message', arrow: 'A -> B: doSomething()', desc: 'A synchronous call from A to B. A waits for B to finish.' },
      { name: 'Return', arrow: 'B --> A: result', desc: 'B sends a response back to A.' },
      { name: 'Self-call', arrow: 'A -> A: internalMethod()', desc: 'An object calling one of its own methods.' },
    ],
    howToConnect: `Add lifelines to the canvas first using the toolbar. Then select a lifeline and drag from its connection dot to another lifeline to draw a message arrow. Order matters, messages are drawn top to bottom, representing time flowing downward.`,
    codeNote: `Paste Java, Python, or JavaScript code with classes that hold references to each other and call each other's methods. The tool traces those method calls and turns them into message arrows between lifelines automatically.`,
    sampleLangs: ['Java', 'Python', 'JavaScript'],
  },
];

// ─── Collapsible section ──────────────────────────────────────────────────────
function Section({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-[#3e3e42] rounded-lg overflow-hidden mb-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[#2d2d30] hover:bg-[#3e3e42] transition-colors text-left"
      >
        <span className="text-sm font-semibold text-white">{title}</span>
        {open ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
      </button>
      {open && (
        <div className="px-4 py-4 bg-[#1e1e1e] text-sm text-gray-300 leading-relaxed">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Code sample block ────────────────────────────────────────────────────────
function CodeBlock({ code }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <div className="relative rounded border border-[#3e3e42] overflow-hidden mt-2">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#2d2d30] border-b border-[#3e3e42]">
        <span className="text-xs text-gray-400 font-mono">sample</span>
        <button
          onClick={handleCopy}
          className="text-xs text-gray-400 hover:text-white transition-colors px-2 py-0.5 rounded hover:bg-[#3e3e42]"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-xs font-mono text-[#d4d4d4] bg-[#1e1e1e] leading-5 max-h-60 overflow-y-auto">
        {code}
      </pre>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────
export default function DocumentationModal({ onClose }) {
  const [activeTab, setActiveTab] = useState('class');
  const [activeSampleLang, setActiveSampleLang] = useState({});

  const diagram = DIAGRAMS.find(d => d.id === activeTab);

  const getLang = (diagramId, langs) => activeSampleLang[diagramId] || langs[0];
  const setLang = (diagramId, lang) => setActiveSampleLang(prev => ({ ...prev, [diagramId]: lang }));

  const getSample = (diagramId, lang) => CODE_SAMPLES[diagramId]?.[lang] || null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70"
      onClick={onClose}
    >
      <div
        className="bg-[#252526] border border-[#3e3e42] rounded-xl shadow-2xl w-full max-w-3xl mx-4 flex flex-col"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#3e3e42] flex-shrink-0">
          <div className="flex items-center gap-3">
            <BookOpen size={20} className="text-[#007acc]" />
            <div>
              <h2 className="text-lg font-bold text-white">Documentation</h2>
              <p className="text-xs text-gray-400 mt-0.5">How the diagrams work and how to use Code to Diagram</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-[#3e3e42] text-gray-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-[#3e3e42] flex-shrink-0 px-6">
          {DIAGRAMS.map(d => (
            <button
              key={d.id}
              onClick={() => setActiveTab(d.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors mr-1 ${
                activeTab === d.id
                  ? 'border-[#007acc] text-white'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <span style={{ color: activeTab === d.id ? d.color : undefined }}>{d.icon}</span>
              {d.label}
            </button>
          ))}
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">

          {/* What is it */}
          <Section title={`What is a ${diagram.label}?`} defaultOpen>
            <p>{diagram.what}</p>
          </Section>

          {/* Elements */}
          <Section title="Elements you can add" defaultOpen>
            <div className="space-y-3">
              {diagram.elements.map(el => (
                <div key={el.name} className="flex gap-3">
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded flex-shrink-0 h-fit mt-0.5"
                    style={{ background: '#2d2d30', border: `1px solid ${diagram.color}`, color: diagram.color }}
                  >
                    {el.name}
                  </span>
                  <span>{el.desc}</span>
                </div>
              ))}
            </div>
          </Section>

          {/* Relationships */}
          <Section title="Relationship types and what they mean" defaultOpen>
            <div className="space-y-4">
              {diagram.relations.map(r => (
                <div key={r.name}>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-xs font-bold text-white">{r.name}</span>
                    <code className="text-xs font-mono text-[#9cdcfe] bg-[#2d2d30] px-2 py-0.5 rounded">{r.arrow}</code>
                  </div>
                  <p className="text-gray-400 text-xs leading-relaxed">{r.desc}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* How to connect */}
          <Section title="How to draw connections">
            <p>{diagram.howToConnect}</p>
          </Section>

          {/* Code to Diagram samples */}
          <Section title={`Code to Diagram: sample ${diagram.label.toLowerCase()} code`} defaultOpen>
            <p className="mb-3 text-gray-400">{diagram.codeNote}</p>

            {/* Language tabs */}
            <div className="flex gap-1 mb-2 flex-wrap">
              {diagram.sampleLangs.map(lang => (
                <button
                  key={lang}
                  onClick={() => setLang(diagram.id, lang)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
                    getLang(diagram.id, diagram.sampleLangs) === lang
                      ? 'bg-[#007acc] text-white'
                      : 'bg-[#3c3c3c] text-gray-300 hover:bg-[#4a4a4f]'
                  }`}
                >
                  <Code size={11} />
                  {lang}
                </button>
              ))}
            </div>

            {getSample(diagram.id, getLang(diagram.id, diagram.sampleLangs)) ? (
              <CodeBlock code={getSample(diagram.id, getLang(diagram.id, diagram.sampleLangs))} />
            ) : (
              <p className="text-gray-500 text-xs italic">No sample available for this language yet.</p>
            )}

            <p className="mt-3 text-xs text-gray-500">
              To use: click <span className="text-white font-medium">Code to Diagram</span> in the toolbar, paste or upload code like the sample above, then hit Convert.
            </p>
          </Section>

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#3e3e42] flex-shrink-0 flex items-center justify-between">
          <span className="text-xs text-gray-500">CodeSync Documentation</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm bg-[#3c3c3c] hover:bg-[#4a4a4f] text-white rounded transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}