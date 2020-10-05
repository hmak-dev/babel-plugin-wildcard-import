# babel-plugin-wildcard-import
Babel plugin to import multiple files using wildcard syntax.

## Installation
#### npm
```bash
npm install --save-dev babel-plugin-wildcard-import
```

#### yarn
```bash
yarn add --dev babel-plugin-wildcard-import
```

## Usage
In your babel configuration file, just add the package name into your plugins array.
```javascript
{
    plugins: [
        'babel-plugin-wildcard-import'
    ]
}
```
or
```javascript
{
    plugins: [
        'wildcard-import'
    ]
}
```