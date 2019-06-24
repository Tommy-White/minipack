/**
 * 
 * Module bundler 编译一些小段代码成更大的并且复杂的代码可以运行在web浏览器中。
 * 这些小段代码都是javascript文件它们之间的依赖关系由模块系统表示
 * 
 * Module bundler 具有入口文件（entry file）的概念。我们让Module bundler明白哪一
 * 个文件是我们程序的主文件，而不是添加一些浏览器中的脚本标记并让它们运行。这个主文件
 * 将会引导整个项目运行。
 * 
 * 我们的 Module bundler 将从这个入口文件开始，他将会弄清那些文件是它的依赖项。接着会
 * 弄清那些文件是其依赖的依赖。它将一直这样进行下去直到弄清项目所有模块，和它们依赖什么
 * 
 * 对项目的梳理叫做依赖图 dependency graph。
 * 
 * 在此例中我们将会创建一个依赖图最后用它将所有模块打包成一个文件
 * 
 * 开始吧：
 * 
 * 注意：这是一个很简单的示例，需要解决的如: 
 * 循环依赖 circular dependencies 、
 * 缓存模块导出 caching module exports、
 * 每个模块只解析一次 parsing each module just once、
 * 和一些其他的场景被省略从而使示例尽量简单。
 * 
 */
const fs = require('fs')
const path = require('path')
const babylon = require('babylon')
const traverse = require('babel-traverse').default
const babel = require('babel-core')


// ID <number> 用来定义每个模块的唯一表示
let ID = 0

// 我们首先创建一个函数createAsset它接受文件路径，读取其中的内容，并提取它的依赖
function createAsset(filename) {
  // 使用fs模块以字符串形式读取文件
  const content = fs.readFileSync(filename, 'utf-8')

  // 我们试图弄清文件的依赖。我们可以通过查找内容中的import字符串行。然而这是很
  // 笨重的方式，因此我们使用了 javscript 的 parser。
  // javascript parser 是一个能认识javascript代码的工具。他们生成更抽象的模型
  // 被称为AST （abstract syntax tree）

  // 一个在线AST查看工具(https://astexplorer.net)

  // AST内包含了许多我们代码的信息。我们可以查询它来弄明白我们代码试图做什么。
  const ast = babylon.parse(content, {
    sourceType: 'module'
  })

  // 定义数组用于保存此模块依赖的相对路径。
  const deps = []

  // 我们遍历AST以尝试了解该模块所依赖的模块上。为此，我们检查AST中的每个导入声明。
  // tarverse方法接受一个ASTmodel作为参数和一个对象参数代表遍历到每一种分别做什么。
  // 此时我们遍历AST并只关系import语句将其值写入数组中。
  traverse(ast, {
    ImportDeclaration: ({node}) => {
      // console.log(node);
      deps.push(node.source.value)
    }
  })

  // 我们可能使用了一些ES6的语法并不被所有浏览器支持，所以我们使用babel (see https://babeljs.io)。
  // 利用之前的AST再转译成能被所有浏览器识别运行的代码。
  // presets 选项是一系列的规则用来告诉babel如何转译我们的代码。我们利用`babel-preset-env`
  // 将代码转译使在大多数浏览器下可以运行。
  const { code } = babel.transformFromAst(ast, null, {
    presets: ['env']
  })

  // 最后返回一个对象包含了部分信息
  return {
    // 我们通过递增一个简单的方法为该模块分配一个唯一的标识符
    id: ID++,
    // 文件路径
    filename,
    // 依赖的相对地址
    deps,
    // 转移后的代码
    code
  }
  // console.log(ast);
}

// 现在我们可以提取单个模块的依赖关系了。首先提取入口文件的依赖项。
// 接着我们要提取每个依赖的依赖关系我们将继续这样做，直到我们弄清楚
// 每个模块在应用程序中以及它们如何相互依赖。 此项目的这种理解被称为
// 依赖图 dependency graph.
// 我们顶一个另一个函数createGrap它接受一个入口文件路径作为参数
function createGraph(entry) {
  // 开始解析入口文件
  const mainAsset = createAsset(entry)

  // 我们将使用队列来解析每个资产的依赖关系。为了达到目的我们首先
  // 定义一个只有入口资产的数组。
  const queue = [mainAsset];

  // 我们使用`for ... of` loop迭代队列，开始时队列中只包含一个资源
  // 但在我们迭代的过程中我们将会附加其他的资产到队列中。这个循环将在
  // 队列为空是结束。
  for(const asset of queue) {
    // 使用内部模块path.dirname读取模块所属目录。
    const dirname = path.dirname(asset.filename)

    // 我们每一个资产都有此模块依赖的相对路径列表。我们将迭代这个列表使用之前的
    // createAsset 函数解析他们，然后在这个对象中记录模块的依赖
    asset.mapping = {}

    // 我们的`createAsset（）`函数需要一个绝对文件名。依赖列表是相对路径。
    // 他们是相对与导入它们时的相对路径。
    asset.deps.forEach(relativePath => {
      // 我们可以改变相对路径通过将其与目录的路径连接成绝对的父资产。
      const absPath = path.join(dirname, relativePath);

      // is there need adds .js ???
      // 解析资产
      const child = createAsset(absPath + '.js')

      // 此mapping关系很关键，决定了我们的依赖对应了哪一个唯一的模块（通过模块解析后的唯一ID）
      asset.mapping[relativePath] = child.id

      // 最终我们将child资产推进队列这样就会使队列不断loop，所以child的依赖也会接着被解析
      queue.push(child)
     })
  }


  // 最终queue包含了所有模块依赖关系形成的一个队列。这就是我们如何去表示依赖图。
  return queue
}

// 接下来，我们将会定义一个函数它接受我们之前创建的 graph 生成一个可在浏览器运行的bundle文件
// 我们的bundle将仅仅包含一个子执行方法：
//
// (function() {})()
// 
// 该方将将接受只接受一个参数，一个包含了我们graph中所有模块关系的对象。
function bundle(graph) {
  let modules = '';

  // 再开始我们函数体之前，我们将构造一个对象用于当作参数传入。请注意我们这个字符串
  // 构建由两个花括号（{}）包裹，因此对于每个模块，我们添加这种格式的字符串：`key：value，`。
  graph.forEach(mod => {
    modules += `${mod.id}: [
      function(require, module, exports) {
        ${mod.code}
      },
      ${JSON.stringify(mod.mapping)}
    ],`
  })

  const result = `
    (function(modules) {
      function require(id) {
        const [fn, mapping] = modules[id]

        function localRequire(relativePath) {
          return require(mapping[relativePath])
        }

        const module = { exports: {} }

        fn(localRequire, module, module.exports)

        return module.exports;

      }

      require(0)
    })({
      ${modules}
    })
  `

  return result
}

const graph = createGraph('./src/entry.js')
const result = bundle(graph)

console.log(result);