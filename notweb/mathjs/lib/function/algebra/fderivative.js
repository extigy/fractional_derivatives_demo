'use strict';

function factory (type, config, load, typed) {
  var parse = load(require('../../expression/parse'));
  var simplify = load(require('./simplify'));
  var ConstantNode = load(require('../../expression/node/ConstantNode'));
  var FunctionNode = load(require('../../expression/node/FunctionNode'));
  var OperatorNode = load(require('../../expression/node/OperatorNode'));
  var ParenthesisNode = load(require('../../expression/node/ParenthesisNode'));
  var SymbolNode = load(require('../../expression/node/SymbolNode'));

  var fderivative = typed('fderivative', {
    'Node, SymbolNode, Node, Object': function (expr, variable, alpha, options) {
      var constNodes = {};
      constTag(constNodes, expr, variable.name);
      var res = _fderivative(expr, variable, alpha, constNodes);
      return options.simplify ? simplify(res) : res;
    },
    'Node, SymbolNode, Node': function (expr, variable, alpha) {
      return fderivative(expr, variable, alpha, {simplify: true})
    },

    'string, SymbolNode, Node': function (expr, variable, alpha) {
      return fderivative(parse(expr), variable, alpha)
    },
    'string, SymbolNode, Node, Object': function (expr, variable, alpha, options) {
      return fderivative(parse(expr), variable, alpha, options)
    },

    'string, string, string': function (expr, variable, alpha) {
      return fderivative(parse(expr), parse(variable), parse(alpha))
    },
    'string, string, string, Object': function (expr, variable, alpha, options) {
      return fderivative(parse(expr), parse(variable), parse(alpha), options)
    },

    'Node, string, string': function (expr, variable, alpha) {
      return fderivative(expr, parse(variable), parse(alpha))
    },
    'Node, string, string, Object': function (expr, variable, alpha, options) {
      return fderivative(expr, parse(variable), parse(alpha), options)
    }
  });

  fderivative._simplify = true

  var constTag = typed('constTag', {
    'Object, ConstantNode, string': function (constNodes, node) {
      return constNodes[node] = true;
    },

    'Object, SymbolNode, string': function (constNodes, node, varName) {
      if (node.name != varName) {
        return constNodes[node] = true;
      }
      return false;
    },

    'Object, ParenthesisNode, string': function (constNodes, node, varName) {
      return constTag(constNodes, node.content, varName);
    },

    'Object, FunctionAssignmentNode, string': function (constNodes, node, varName) {
      if (node.params.indexOf(varName) == -1) {
        return constNodes[node] = true;
      }
      return constTag(constNodes, node.expr, varName);
    },

    'Object, FunctionNode | OperatorNode, string': function (constNodes, node, varName) {
      if (node.args.length != 0) {
        var isConst = constTag(constNodes, node.args[0], varName);
        for (var i = 1; i < node.args.length; ++i) {
          isConst = constTag(constNodes, node.args[i], varName) && isConst;
        }

        if (isConst) {
          return constNodes[node] = true;
        }
      }
      return false;
    }
  });

  var _fderivative = typed('_fderivative', {
    'ConstantNode, SymbolNode, Node, Object': function (node, x, alpha, constNodes) {
        // d/dx(c) = c * d/dx(x^0)
        return new OperatorNode('*', 'multiply', [
          node.clone(),
          new OperatorNode('*', 'multiply', [
              new OperatorNode('/', 'divide', [
                new FunctionNode('gamma', [parse('1')]),
                new FunctionNode('gamma', [new OperatorNode('-', 'subtract', [parse('1'),alpha])])
              ]),
              new OperatorNode('^', 'pow', [
                x.clone(),
                new OperatorNode('-', 'subtract', [parse('0'),alpha])
              ])
          ])
        ]);
    },

    'SymbolNode, SymbolNode, Node, Object': function (node, x, alpha, constNodes) {
      if (constNodes[node] !== undefined) {
        //Some value other than x. So do d/dx(x^0).
        return _fderivative(parse('1'), x, alpha, constNodes)
      }
      //d/dx(x) = gamma(2)/gamma(2-a) * x^(1-a)
      return new OperatorNode('*', 'multiply', [
          new OperatorNode('/', 'divide', [
            new FunctionNode('gamma', [parse('2')]),
            new FunctionNode('gamma', [new OperatorNode('-', 'subtract', [parse('2'),alpha])])
          ]),
          new OperatorNode('^', 'pow', [
            x.clone(),
            new OperatorNode('-', 'subtract', [parse('1'),alpha])
          ])
      ]);
    },

    'ParenthesisNode, SymbolNode, Node, Object': function (node, x, alpha, constNodes) {
      return new ParenthesisNode(_fderivative(node.content, x, alpha, constNodes));
    },

    'FunctionAssignmentNode, SymbolNode, Node, Object': function (node, x, alpha, constNodes) {
      return _derivative(node.expr, x, alpha, constNodes);
    },

    'FunctionNode, SymbolNode, Node, Object': function (node, x, alpha, constNodes) {
      //Single arguments only plz
      if (node.args.length != 1) {
        throw new Error('Function "' + node.name + '" not supported by fractional derivative');
      }

      if (node.args[0].name !== x.name) {
        if (constNodes[node.args[0]] !== undefined) {
          //Our argument is a constant, so whole function is constant.
          //return node*d(1)/dx
          return new OperatorNode('*', 'multiply', [eval(node.args[0]),_fderivative(parse('1'), x, alpha, constNodes)])
        }
        throw new Error('Chain rule not supported by fractional derivative.');
      }

      var funcDerivative;
      //Hard code some analytic results and save them into funcDerivative variable
      switch (node.name) {
        case 'sin':
        case 'cos':
        case 'gamma':
        default: throw new Error('Function "' + node.name + '" not supported by fractional derivative');
      }
    },

    'OperatorNode, SymbolNode, Node, Object': function (node, x, alpha, constNodes) {
      //Our arguments are constant, so whole function is constant.
      if (constNodes[node] !== undefined) {
        return new OperatorNode('*', 'multiply', [
          node.clone(),
          _fderivative(parse('1'), x, alpha, constNodes)
        ]);
      }

      var arg1 = node.args[0];
      var arg2 = node.args[1];

      switch (node.op) {
        case '+':
        case '-':
          // d/dx(+/-f(x)) = +/-f'(x)
          if (node.args.length == 1) {
            return new OperatorNode(node.op, node.fn, [_fderivative(arg1, x, alpha, constNodes)]);
          }

          // Linearity of differentiation, d/dx(f(x) +/- g(x)) = f'(x) +/- g'(x)
          return new OperatorNode(node.op, node.fn, [
            _fderivative(arg1, x, alpha, constNodes),
            _fderivative(arg2, x, alpha, constNodes)
          ]);
        case '*':
          // d/dx(c*f(x)) = c*f'(x)
          if (constNodes[arg1] !== undefined || constNodes[arg2] !== undefined) {
            var newArgs = (constNodes[arg1] !== undefined)
              ? [arg1.clone(), _fderivative(arg2, x, alpha, constNodes)]
              : [arg2.clone(), _fderivative(arg1, x, alpha, constNodes)];

            return new OperatorNode('*', 'multiply', newArgs);
          }

          throw new Error('Product rule not supported by fractional derivative.');
        case '/':
          // d/dx(f(x) / c) = f'(x) / c
          if (constNodes[arg2] !== undefined) {
            return new OperatorNode('/', 'divide', [_fderivative(arg1, x, alpha, constNodes), arg2]);
          }

          throw new Error('Quotient rule not supported by fractional derivative.');
        case '^':
          if (constNodes[arg1] !== undefined) {
            // If is secretly constant; 0^f(x) = 1 (in JS), 1^f(x) = 1
            if (type.isConstantNode(arg1) && (arg1.value === '0' || arg1.value === '1')) {
              return _fderivative(parse('1'), x, alpha, constNodes);
            }

            throw new Error('Functional power rule not yet supported by fractional derivative.');
          }

          if (constNodes[arg2] !== undefined) {
            if (type.isConstantNode(arg2)) {
              var expValue = arg2.value;

              // If is secretly constant; f(x)^0 = 1 -> d/dx(1) = 0
              if (expValue === '0') {
                return _fderivative(parse('1'), x, alpha, constNodes);
              }
              // Ignore exponent; f(x)^1 = f(x)
              if (expValue === '1') {
                return _fderivative(arg1, x, alpha, constNodes);
              }
            }
          }
          // TODO: FIX. FOR NOW ASSUMING ARG2 IS CONST
          return new OperatorNode('*', 'multiply', [
                 new OperatorNode('*', 'multiply', [
                  new OperatorNode('/', 'divide', [
                    new FunctionNode('gamma', [
                        new OperatorNode('-', 'subtract', [
                            new ConstantNode('2', config.number),
                            alpha
                        ])
                    ]),
                    new FunctionNode('gamma', [new ConstantNode('2', config.number)])
                  ]),
                  new OperatorNode('*', 'multiply', [
                    new OperatorNode('/', 'divide', [
                      new FunctionNode('gamma', [
                            new OperatorNode('+', 'add', [
                                arg2.clone(),
                                new ConstantNode('1', config.number)
                            ])
                      ]),
                      new FunctionNode('gamma', [
                          new OperatorNode('+', 'add', [
                              new OperatorNode('-', 'subtract', [
                                  arg2.clone(),
                                  alpha
                              ]),
                              new ConstantNode('1', config.number)
                          ])
                      ])
                    ]),
                    new OperatorNode('*', 'multiply', [
                        new OperatorNode('^', 'pow', [
                            arg1.clone(),
                            new OperatorNode('-', 'subtract', [arg2.clone(),alpha])
                        ]),
                        _fderivative(arg1.clone(), x, alpha, constNodes)
                    ])
                ])
                ]),
                new OperatorNode('^', 'pow', [x.clone(),
                  new OperatorNode('-', 'subtract', [
                      alpha,
                      new ConstantNode('1', config.number),
                  ])
                ]),
                ])

        case '%':
        case 'mod':
        default: throw new Error('Operator "' + node.op + '" not supported by derivative');
      }
    }
  });

  return fderivative;
}

exports.name = 'fderivative';
exports.factory = factory;
