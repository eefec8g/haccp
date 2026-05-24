# Clean Code TypeScript - Guide de Référence

Guide adapté de _Clean Code_ de Robert C. Martin, spécialisé pour TypeScript.

Source: [clean-code-typescript](https://github.com/labs42io/clean-code-typescript)

---

## 1. VARIABLES

### 1.1 Noms Significatifs

```typescript
// ❌ Mauvais
const a1 = getUsersArray();
const a2 = filterUsers(a1);

// ✅ Bon
const users = getUsers();
const activeUsers = filterActiveUsers(users);
```

### 1.2 Noms Prononçables

```typescript
// ❌ Mauvais
class DtaRcrd102 {
  genymdhms: Date;
  modymdhms: Date;
}

// ✅ Bon
class Customer {
  generationTimestamp: Date;
  modificationTimestamp: Date;
}
```

### 1.3 Vocabulaire Consistant

```typescript
// ❌ Mauvais - 3 noms différents pour le même concept
getUserInfo();
getUserDetails();
getUserData();

// ✅ Bon - Un seul terme
getUser();
```

### 1.4 Noms Recherchables (Pas de Magic Numbers)

```typescript
// ❌ Mauvais
setTimeout(blastOff, 86400000);
if (user.age > 18) {
}

// ✅ Bon
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const ADULT_AGE_THRESHOLD = 18;

setTimeout(blastOff, MILLISECONDS_PER_DAY);
if (user.age > ADULT_AGE_THRESHOLD) {
}
```

### 1.5 Variables Explicatives

```typescript
// ❌ Mauvais
const address = 'One Infinite Loop, Cupertino 95014';
const cityZipCodeRegex = /^[^,\\]+[,\\\s]+(.+?)\s*(\d{5})?$/;
saveCityZipCode(
  address.match(cityZipCodeRegex)[1],
  address.match(cityZipCodeRegex)[2]
);

// ✅ Bon
const address = 'One Infinite Loop, Cupertino 95014';
const cityZipCodeRegex = /^[^,\\]+[,\\\s]+(.+?)\s*(\d{5})?$/;
const [_, city, zipCode] = address.match(cityZipCodeRegex) || [];
saveCityZipCode(city, zipCode);
```

### 1.6 Pas de Mapping Mental

```typescript
// ❌ Mauvais
const u = getUser();
const s = getSubscription();
for (let i = 0; i < users.length; i++) {}

// ✅ Bon
const user = getUser();
const subscription = getSubscription();
for (const user of users) {
}
```

### 1.7 Pas de Contexte Redondant

```typescript
// ❌ Mauvais
class Car {
  carMake: string;
  carModel: string;
  carColor: string;
}

// ✅ Bon
class Car {
  make: string;
  model: string;
  color: string;
}
```

### 1.8 Arguments par Défaut

```typescript
// ❌ Mauvais
function loadPages(count?: number) {
  const loadCount = count !== undefined ? count : 10;
}

// ✅ Bon
function loadPages(count: number = 10) {
  // ...
}
```

---

## 2. FONCTIONS

### 2.1 Limiter les Paramètres (max 2-3)

```typescript
// ❌ Mauvais
function createMenu(
  title: string,
  body: string,
  buttonText: string,
  cancellable: boolean
) {}

// ✅ Bon
interface MenuOptions {
  title: string;
  body: string;
  buttonText: string;
  cancellable: boolean;
}

function createMenu(options: MenuOptions) {}
```

### 2.2 Single Responsibility (Une Seule Chose)

```typescript
// ❌ Mauvais
function emailActiveClients(clients: Client[]) {
  clients.forEach((client) => {
    const clientRecord = database.lookup(client);
    if (clientRecord.isActive()) {
      email(client);
    }
  });
}

// ✅ Bon
function emailActiveClients(clients: Client[]) {
  clients.filter(isActiveClient).forEach(email);
}

function isActiveClient(client: Client): boolean {
  const clientRecord = database.lookup(client);
  return clientRecord.isActive();
}
```

### 2.3 Noms Descriptifs

```typescript
// ❌ Mauvais
function addToDate(date: Date, month: number): Date {}

// ✅ Bon
function addMonthToDate(date: Date, month: number): Date {}
```

### 2.4 Un Seul Niveau d'Abstraction

```typescript
// ❌ Mauvais
function parseBetterJSAlternative(code: string) {
  const REGEXES = [
    /* ... */
  ];
  const statements = code.split(' ');
  const tokens = [];

  // Mélange de niveaux d'abstraction
  REGEXES.forEach((REGEX) => {
    statements.forEach((statement) => {
      // parsing logic
    });
  });

  const ast = [];
  tokens.forEach((token) => {
    // lex logic
  });

  ast.forEach((node) => {
    // parsing...
  });
}

// ✅ Bon
function parseBetterJSAlternative(code: string) {
  const tokens = tokenize(code);
  const syntaxTree = parse(tokens);

  syntaxTree.forEach((node) => {
    // parsing...
  });
}

function tokenize(code: string): Token[] {
  // ...
}

function parse(tokens: Token[]): SyntaxTree {
  // ...
}
```

### 2.5 Pas de Flags Booléens

```typescript
// ❌ Mauvais
function createFile(name: string, temp: boolean) {
  if (temp) {
    fs.create(`./temp/${name}`);
  } else {
    fs.create(name);
  }
}

// ✅ Bon
function createFile(name: string) {
  fs.create(name);
}

function createTempFile(name: string) {
  createFile(`./temp/${name}`);
}
```

### 2.6 Éviter les Effets de Bord

```typescript
// ❌ Mauvais
let name = 'Ryan McDermott';

function splitIntoFirstAndLastName() {
  name = name.split(' '); // Modifie la variable globale!
}

// ✅ Bon
function splitIntoFirstAndLastName(name: string): [string, string] {
  return name.split(' ') as [string, string];
}

const name = 'Ryan McDermott';
const [firstName, lastName] = splitIntoFirstAndLastName(name);
```

### 2.7 Éviter les Mutations

```typescript
// ❌ Mauvais
function addItemToCart(cart: CartItem[], item: CartItem): void {
  cart.push(item); // Mute l'array original!
}

// ✅ Bon
function addItemToCart(cart: CartItem[], item: CartItem): CartItem[] {
  return [...cart, item]; // Retourne un nouvel array
}
```

### 2.8 Préférer le Style Fonctionnel

```typescript
// ❌ Mauvais
const contributions = [];
for (let i = 0; i < programmers.length; i++) {
  const programmer = programmers[i];
  if (programmer.language === 'JavaScript') {
    contributions.push(programmer.contributions);
  }
}

// ✅ Bon
const contributions = programmers
  .filter((programmer) => programmer.language === 'JavaScript')
  .map((programmer) => programmer.contributions);
```

### 2.9 Encapsuler les Conditions

```typescript
// ❌ Mauvais
if (subscription.isTrial || account.balance > 0) {
  // ...
}

// ✅ Bon
function canActivateService(
  subscription: Subscription,
  account: Account
): boolean {
  return subscription.isTrial || account.balance > 0;
}

if (canActivateService(subscription, account)) {
  // ...
}
```

### 2.10 Éviter les Conditions Négatives

```typescript
// ❌ Mauvais
function isEmailNotUsed(email: string): boolean {}

if (!isEmailNotUsed(email)) {
} // Double négation!

// ✅ Bon
function isEmailUsed(email: string): boolean {}

if (isEmailUsed(email)) {
}
```

### 2.11 Supprimer le Code Mort

```typescript
// ❌ Mauvais
function oldRequestModule(url: string) {
  // Ancienne implémentation...
}

function newRequestModule(url: string) {
  // Nouvelle implémentation
}

const request = newRequestModule;
// oldRequestModule reste dans le code! Supprimer!

// ✅ Bon
function requestModule(url: string) {
  // Implémentation actuelle
}

const request = requestModule;
```

---

## 3. OBJETS ET DATA STRUCTURES

### 3.1 Getters et Setters

```typescript
// ❌ Mauvais
class BankAccount {
  balance: number = 0;
}

const account = new BankAccount();
account.balance = 100; // Pas de validation!

// ✅ Bon
class BankAccount {
  private _balance: number = 0;

  get balance(): number {
    return this._balance;
  }

  set balance(value: number) {
    if (value < 0) {
      throw new Error('Balance cannot be negative');
    }
    this._balance = value;
  }
}
```

### 3.2 Membres Private/Protected

```typescript
// ❌ Mauvais
class Circle {
  radius: number; // Public par défaut

  constructor(radius: number) {
    this.radius = radius;
  }
}

// ✅ Bon
class Circle {
  constructor(private readonly radius: number) {}

  get area(): number {
    return Math.PI * this.radius ** 2;
  }
}
```

### 3.3 Préférer l'Immutabilité

```typescript
// ❌ Mauvais
interface Config {
  host: string;
  port: number;
}

const config: Config = {
  host: 'localhost',
  port: 8080,
};

config.port = 3000; // Mutation!

// ✅ Bon
interface Config {
  readonly host: string;
  readonly port: number;
}

const config: Config = {
  host: 'localhost',
  port: 8080,
};

// config.port = 3000; // Erreur TypeScript!

// Pour modifier, créer un nouvel objet
const newConfig: Config = { ...config, port: 3000 };
```

### 3.4 Type vs Interface

```typescript
// Utiliser type pour unions et intersections
type StringOrNumber = string | number;
type Point = { x: number } & { y: number };

// Utiliser interface pour extends et implements
interface Animal {
  name: string;
}

interface Dog extends Animal {
  breed: string;
}

class Labrador implements Dog {
  name: string;
  breed: string;
}
```

---

## 4. CLASSES

### 4.1 Classes Petites et Cohésives

```typescript
// ❌ Mauvais - Classe qui fait trop de choses
class UserManager {
  createUser() {}
  deleteUser() {}
  sendEmail() {} // Email n'est pas lié à User!
  generateReport() {} // Report n'est pas lié à User!
  exportToPDF() {} // Export n'est pas lié à User!
}

// ✅ Bon - Séparation des responsabilités
class UserService {
  createUser() {}
  deleteUser() {}
}

class EmailService {
  sendEmail() {}
}

class ReportService {
  generateReport() {}
  exportToPDF() {}
}
```

### 4.2 Composition Over Inheritance

```typescript
// ❌ Mauvais - Héritage inapproprié
class Employee {
  constructor(
    private name: string,
    private email: string
  ) {}
}

class EmployeeTaxData extends Employee {
  constructor(
    name: string,
    email: string,
    private ssn: string
  ) {
    super(name, email);
  }
}

// ✅ Bon - Composition
class Employee {
  private taxData: EmployeeTaxData;

  constructor(
    private name: string,
    private email: string
  ) {}

  setTaxData(taxData: EmployeeTaxData) {
    this.taxData = taxData;
  }
}

class EmployeeTaxData {
  constructor(
    public ssn: string,
    public salary: number
  ) {}
}
```

### 4.3 Method Chaining (Fluent Interface)

```typescript
// ❌ Mauvais
class QueryBuilder {
  from(table: string): void {
    this.table = table;
  }

  where(condition: string): void {
    this.conditions.push(condition);
  }
}

const builder = new QueryBuilder();
builder.from('users');
builder.where('active = true');

// ✅ Bon
class QueryBuilder {
  from(table: string): this {
    this.table = table;
    return this;
  }

  where(condition: string): this {
    this.conditions.push(condition);
    return this;
  }
}

const query = new QueryBuilder().from('users').where('active = true').build();
```

---

## 5. SOLID PRINCIPLES

### 5.1 Single Responsibility Principle (SRP)

```typescript
// ❌ Mauvais - Classe avec plusieurs responsabilités
class UserSettings {
  constructor(private user: User) {}

  changeSettings(settings: UserSettings) {
    if (this.verifyCredentials()) {
      // ...
    }
  }

  verifyCredentials() {
    // Authentification n'est pas la responsabilité de UserSettings!
  }
}

// ✅ Bon
class UserAuth {
  constructor(private user: User) {}

  verifyCredentials(): boolean {
    // ...
  }
}

class UserSettings {
  constructor(
    private user: User,
    private auth: UserAuth
  ) {}

  changeSettings(settings: UserSettings) {
    if (this.auth.verifyCredentials()) {
      // ...
    }
  }
}
```

### 5.2 Open/Closed Principle (OCP)

```typescript
// ❌ Mauvais - Modifier la classe pour chaque nouveau type
class AjaxAdapter {
  constructor() {
    this.name = 'ajaxAdapter';
  }
}

class NodeAdapter {
  constructor() {
    this.name = 'nodeAdapter';
  }
}

class HttpRequester {
  constructor(private adapter: AjaxAdapter | NodeAdapter) {}

  fetch(url: string) {
    // Switch sur le type d'adapter - viole OCP
    if (this.adapter.name === 'ajaxAdapter') {
      return makeAjaxCall(url);
    } else if (this.adapter.name === 'nodeAdapter') {
      return makeHttpCall(url);
    }
  }
}

// ✅ Bon - Ouvert à l'extension, fermé à la modification
interface Adapter {
  request(url: string): Promise<Response>;
}

class AjaxAdapter implements Adapter {
  request(url: string): Promise<Response> {
    // ajax request
  }
}

class NodeAdapter implements Adapter {
  request(url: string): Promise<Response> {
    // node http request
  }
}

class HttpRequester {
  constructor(private adapter: Adapter) {}

  fetch(url: string): Promise<Response> {
    return this.adapter.request(url);
  }
}
```

### 5.3 Liskov Substitution Principle (LSP)

```typescript
// ❌ Mauvais - Rectangle/Square paradox
class Rectangle {
  constructor(
    protected width: number,
    protected height: number
  ) {}

  setWidth(width: number): void {
    this.width = width;
  }

  setHeight(height: number): void {
    this.height = height;
  }

  getArea(): number {
    return this.width * this.height;
  }
}

class Square extends Rectangle {
  setWidth(width: number): void {
    this.width = width;
    this.height = width; // Viole LSP!
  }

  setHeight(height: number): void {
    this.width = height;
    this.height = height; // Viole LSP!
  }
}

// ✅ Bon - Composition au lieu d'héritage
interface Shape {
  getArea(): number;
}

class Rectangle implements Shape {
  constructor(
    private width: number,
    private height: number
  ) {}

  getArea(): number {
    return this.width * this.height;
  }
}

class Square implements Shape {
  constructor(private side: number) {}

  getArea(): number {
    return this.side ** 2;
  }
}
```

### 5.4 Interface Segregation Principle (ISP)

```typescript
// ❌ Mauvais - Interface trop grosse
interface Worker {
  work(): void;
  eat(): void;
  sleep(): void;
}

class Robot implements Worker {
  work() {
    /* ... */
  }
  eat() {
    throw new Error("Robots don't eat!");
  } // Problème!
  sleep() {
    throw new Error("Robots don't sleep!");
  } // Problème!
}

// ✅ Bon - Interfaces séparées
interface Workable {
  work(): void;
}

interface Eatable {
  eat(): void;
}

interface Sleepable {
  sleep(): void;
}

class Human implements Workable, Eatable, Sleepable {
  work() {
    /* ... */
  }
  eat() {
    /* ... */
  }
  sleep() {
    /* ... */
  }
}

class Robot implements Workable {
  work() {
    /* ... */
  }
}
```

### 5.5 Dependency Inversion Principle (DIP)

```typescript
// ❌ Mauvais - Dépendance sur implémentation concrète
class InventoryRequester {
  requestItems() {
    // Crée une dépendance concrète
    const requester = new RequestModule();
    requester.request('https://api/inventory');
  }
}

// ✅ Bon - Dépendance sur abstraction
interface Requester {
  request(url: string): Promise<Response>;
}

class InventoryRequester {
  constructor(private requester: Requester) {} // Injection!

  requestItems() {
    return this.requester.request('https://api/inventory');
  }
}

// Usage
const inventoryRequester = new InventoryRequester(new RequestModule());
```

---

## 6. ERROR HANDLING

### 6.1 Toujours Throw Error Objects

```typescript
// ❌ Mauvais
throw 'Something went wrong';
throw { message: 'error' };

// ✅ Bon
throw new Error('Something went wrong');
throw new ValidationError('Email is required');
```

### 6.2 Toujours Traiter les Erreurs

```typescript
// ❌ Mauvais
try {
  functionThatMightThrow();
} catch (error) {
  console.log(error); // Juste logger et ignorer
}

// ✅ Bon
try {
  functionThatMightThrow();
} catch (error) {
  logger.error(error);
  notifyUser('Something went wrong');
  reportToService(error);
}
```

### 6.3 Toujours Gérer les Promesses Rejetées

```typescript
// ❌ Mauvais
fetchData().then((data) => process(data)); // Pas de catch!

// ✅ Bon
fetchData()
  .then((data) => process(data))
  .catch((error) => logger.error(error));

// Ou avec async/await
async function getData() {
  try {
    const data = await fetchData();
    return process(data);
  } catch (error) {
    logger.error(error);
    throw error; // Re-throw si nécessaire
  }
}
```

---

## 7. FORMATTING

### 7.1 Capitalisation Consistante

```typescript
// ❌ Mauvais
const DAYS_IN_WEEK = 7;
const daysInMonth = 30;
const songs = ['Back In Black', 'Stairway to Heaven'];
const Artists = ['ACDC', 'Led Zeppelin'];

function eraseDatabase() {}
function restore_database() {}

class animal {}
class Alpaca {}

// ✅ Bon
const DAYS_IN_WEEK = 7; // UPPER_SNAKE pour constantes
const DAYS_IN_MONTH = 30;

const songs = ['Back In Black']; // camelCase pour variables
const artists = ['ACDC'];

function eraseDatabase() {} // camelCase pour fonctions
function restoreDatabase() {}

class Animal {} // PascalCase pour classes
class Alpaca {}
```

### 7.2 Organiser les Imports

```typescript
// ✅ Bon - Ordre des imports
// 1. Polyfills
import 'reflect-metadata';

// 2. Node built-ins
import * as fs from 'fs';
import * as path from 'path';

// 3. External packages
import express from 'express';
import { z } from 'zod';

// 4. Internal packages (@/)
import { db } from '@/lib/prisma';
import { UserService } from '@/services/user';

// 5. Parent directory imports
import { Config } from '../config';

// 6. Sibling imports
import { helper } from './helper';

// 7. Type imports (separate)
import type { User } from '@/types';
```

---

## 8. COMMENTS

### 8.1 Code Auto-Documenté

```typescript
// ❌ Mauvais - Commentaire qui explique du mauvais code
// Check if employee is eligible for full benefits
if (employee.flags & HOURLY_FLAG && employee.age > 65) {
}

// ✅ Bon - Code qui s'explique lui-même
const isEligibleForFullBenefits = employee.isHourly && employee.age > 65;
if (isEligibleForFullBenefits) {
}
```

### 8.2 Pas de Code Commenté

```typescript
// ❌ Mauvais
function processUser(user: User) {
  // const oldWay = user.process();
  // const result = oldWay.map(x => x.value);
  // return result.filter(Boolean);

  return user.processNew();
}

// ✅ Bon - Supprimer le code mort, git l'a en historique
function processUser(user: User) {
  return user.processNew();
}
```

### 8.3 Pas de Commentaires Journal

```typescript
// ❌ Mauvais
/**
 * 2016-12-20: Removed monads (wasn't using them)
 * 2016-10-01: Improved using special monads
 * 2016-02-03: Added type checking
 */
function combine(a: number, b: number): number {
  return a + b;
}

// ✅ Bon - Utiliser git log pour l'historique
function combine(a: number, b: number): number {
  return a + b;
}
```

---

## 9. TESTING

### 9.1 F.I.R.S.T. Rules

- **Fast**: Tests rapides
- **Independent**: Pas de dépendances entre tests
- **Repeatable**: Même résultat à chaque fois
- **Self-Validating**: Pass/Fail clair
- **Timely**: Écrits avant le code (TDD)

### 9.2 Un Concept Par Test

```typescript
// ❌ Mauvais - Test qui vérifie plusieurs choses
describe('MomentJS', () => {
  it('handles dates', () => {
    // Test 30-day months
    // Test 29-day months
    // Test 28-day months
  });
});

// ✅ Bon - Un concept par test
describe('MomentJS', () => {
  it('handles 30-day months', () => {
    // ...
  });

  it('handles leap year', () => {
    // ...
  });

  it('handles non-leap year', () => {
    // ...
  });
});
```

### 9.3 Noms Descriptifs

```typescript
// ❌ Mauvais
describe('User', () => {
  it('test1', () => {});
  it('should work', () => {});
});

// ✅ Bon
describe('UserService', () => {
  it('should create a user with valid email', () => {});
  it('should throw ValidationError when email is invalid', () => {});
  it('should not allow duplicate emails', () => {});
});
```

---

## 10. ASYNC

### 10.1 Async/Await > Promises > Callbacks

```typescript
// ❌ Mauvais - Callbacks
import { get } from 'request';

get('https://api.com/data', (error, response) => {
  if (error) {
    console.error(error);
    return;
  }
  // process response
});

// ⚠️ Moyen - Promises
import { get } from 'request-promise';

get('https://api.com/data')
  .then((response) => {
    // process response
  })
  .catch((error) => {
    console.error(error);
  });

// ✅ Bon - Async/Await
import { get } from 'request-promise';

async function getData() {
  try {
    const response = await get('https://api.com/data');
    // process response
    return response;
  } catch (error) {
    console.error(error);
    throw error;
  }
}
```

---

## CHECKLIST RAPIDE

### Variables

- [ ] Noms significatifs et prononçables
- [ ] Vocabulaire consistant
- [ ] Pas de magic numbers
- [ ] Pas de `u`, `i`, `x` (mapping mental)
- [ ] Arguments par défaut utilisés

### Fonctions

- [ ] Max 2-3 paramètres
- [ ] Single Responsibility
- [ ] Pas de flags booléens
- [ ] Pas d'effets de bord
- [ ] Style fonctionnel préféré

### Classes

- [ ] Petites et cohésives
- [ ] SOLID respecté
- [ ] Composition > Héritage
- [ ] Private/Protected utilisés
- [ ] Immutabilité préférée

### TypeScript

- [ ] Pas de `any`
- [ ] Types explicites
- [ ] Readonly quand approprié

### Errors

- [ ] `throw new Error()` (pas de strings)
- [ ] Toujours catch et traiter
- [ ] Promises avec .catch()

### Comments

- [ ] Pas de code commenté
- [ ] Code auto-documenté
- [ ] Pas de journal dans le code
