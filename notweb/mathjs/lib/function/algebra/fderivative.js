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
    'Node, SymbolNode, ConstantNode, Object': function (expr, variable, alpha, options) {
      var constNodes = {};
      constTag(constNodes, expr, variable.name);
      var res = _fderivative(expr, variable, alpha, constNodes);
      return options.simplify ? simplify(res) : res;
    },
    'Node, SymbolNode, ConstantNode': function (expr, variable, alpha) {
      return fderivative(expr, variable, alpha, {simplify: true})
    },

    'string, SymbolNode, ConstantNode': function (expr, variable, alpha) {
      return fderivative(parse(expr), variable, alpha)
    },
    'string, SymbolNode, ConstantNode, Object': function (expr, variable, alpha, options) {
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
    'ConstantNode, SymbolNode, ConstantNode, Object': function (node, x, alpha, constNodes) {
        // d/dx(c) = c * d/dx(1)
        return new OperatorNode('*', 'multiply', [
          node.clone(),
          new OperatorNode('*', 'multiply', [
              new OperatorNode('/', 'divide', [
                new FunctionNode('gamma', [new ConstantNode('1', config.number)]),
                new FunctionNode('gamma', [new OperatorNode('-', 'subtract', [new ConstantNode('1', config.number),alpha])])
              ]),
              new OperatorNode('^', 'pow', [
                x.clone(),
                new OperatorNode('-', 'subtract', [new ConstantNode(0),alpha])
              ])
          ])
        ]);
    },

    'SymbolNode, SymbolNode, ConstantNode, Object': function (node, x, alpha, constNodes) {
      if (constNodes[node] !== undefined) {
        return new OperatorNode('*', 'multiply', [
          node.clone(),
          new OperatorNode('*', 'multiply', [
              new OperatorNode('/', 'divide', [
                new FunctionNode('gamma', [new ConstantNode('1', config.number)]),
                new FunctionNode('gamma', [new OperatorNode('-', 'subtract', [new ConstantNode('1', config.number),alpha])])
              ]),
              new OperatorNode('^', 'pow', [
                x.clone(),
                new OperatorNode('-', 'subtract', [new ConstantNode(0),alpha])
              ])
          ])
        ]);
      }
      return new OperatorNode('*', 'multiply', [
          new OperatorNode('/', 'divide', [
            new FunctionNode('gamma', [new ConstantNode('2', config.number)]),
            new FunctionNode('gamma', [new OperatorNode('-', 'subtract', [new ConstantNode('2', config.number),alpha])])
          ]),
          new OperatorNode('^', 'pow', [
            x.clone(),
            new OperatorNode('-', 'subtract', [new ConstantNode('1', config.number),alpha])
          ])
      ]);
    },

    'ParenthesisNode, SymbolNode, ConstantNode, Object': function (node, x, alpha, constNodes) {
      return new ParenthesisNode(_fderivative(node.content, x, alpha, constNodes));
    },

    'FunctionAssignmentNode, SymbolNode, ConstantNode, Object': function (node, x, alpha, constNodes) {
      if (constNodes[node] !== undefined) {
        return new OperatorNode('*', 'multiply', [
          node.clone(),
          new OperatorNode('*', 'multiply', [
              new OperatorNode('/', 'divide', [
                new FunctionNode('gamma', [new ConstantNode('1', config.number)]),
                new FunctionNode('gamma', [new OperatorNode('-', 'subtract', [new ConstantNode('1', config.number),alpha])])
              ]),
              new OperatorNode('^', 'pow', [
                x.clone(),
                new OperatorNode('-', 'subtract', [new ConstantNode(0),alpha])
              ])
          ])
        ]);
      }
      return _derivative(node.expr, x, alpha, constNodes);
    },

    'FunctionNode, SymbolNode, ConstantNode, Object': function (node, x, alpha, constNodes) {
      if (node.args.length != 1) {
        funcArgsCheck(node);
      }

      if (constNodes[node] !== undefined) {
        return new OperatorNode('*', 'multiply', [
          node.clone(),
          new OperatorNode('*', 'multiply', [
              new OperatorNode('/', 'divide', [
                new FunctionNode('gamma', [new ConstantNode('1', config.number)]),
                new FunctionNode('gamma', [new OperatorNode('-', 'subtract', [new ConstantNode('1', config.number),alpha])])
              ]),
              new OperatorNode('^', 'pow', [
                x.clone(),
                new OperatorNode('-', 'subtract', [new ConstantNode(0),alpha])
              ])
          ])
        ]);
      }

      var arg1 = node.args[0];
      var arg2;

      var div = false;       // is output a fraction?
      var negative = false;  // is output negative?

      var funcDerivative;
      switch (node.name) {
        case 'sin':
        case 'cos':
        case 'gamma':
        default: throw new Error('Function "' + node.name + '" not supported by derivative');
      }

      var op, func;
      if (div) {
        op = '/';
        func = 'divide';
      } else {
        op = '*';
        func = 'multiply';
      }

      /* Apply chain rule to all functions:
         F(x)  = f(g(x))
         F'(x) = g'(x)*f'(g(x)) */
      //var chainDerivative = _fderivative(arg1, x, alpha, constNodes);
      //if (negative) {
      //  chainDerivative = new OperatorNode('-', 'unaryMinus', [chainDerivative]);
      //}
      //return new OperatorNode(op, func, [chainDerivative, funcDerivative]);
      throw new Error('Chain rule not yet supported by fractional derivative.');
    },

    'OperatorNode, SymbolNode, ConstantNode, Object': function (node, x, alpha, constNodes) {
      //if (alpha == '0') {
      //  return node;
      //}
      if (constNodes[node] !== undefined) {
        return new OperatorNode('*', 'multiply', [
          node.clone(),
          new OperatorNode('*', 'multiply', [
              new OperatorNode('/', 'divide', [
                new FunctionNode('gamma', [new ConstantNode('1', config.number)]),
                new FunctionNode('gamma', [new OperatorNode('-', 'subtract', [new ConstantNode('1', config.number),alpha])])
              ]),
              new OperatorNode('^', 'pow', [
                x.clone(),
                new OperatorNode('-', 'subtract', [new ConstantNode(0),alpha])
              ])
          ])
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

          throw new Error('Product rule not yet supported by fractional derivative.');
        case '/':
          // d/dx(f(x) / c) = f'(x) / c
          if (constNodes[arg2] !== undefined) {
            return new OperatorNode('/', 'divide', [_fderivative(arg1, x, alpha, constNodes), arg2]);
          }

          // Quotient rule, d/dx(f(x) / g(x)) = (f'(x)g(x) - f(x)g'(x)) / g(x)^2
          //return new OperatorNode('/', 'divide', [
          //  new OperatorNode('-', 'subtract', [
          //    new OperatorNode('*', 'multiply', [_fderivative(arg1, x, alpha, constNodes), arg2.clone()]),
          //    new OperatorNode('*', 'multiply', [arg1.clone(), _fderivative(arg2, x, alpha, constNodes)])
          //  ]),
          //  new OperatorNode('^', 'pow', [arg2.clone(), new ConstantNode('2', config.number)])
          //]);
          throw new Error('Quotient rule not yet supported by fractional derivative.');
        case '^':
          if (constNodes[arg1] !== undefined) {
            // If is secretly constant; 0^f(x) = 1 (in JS), 1^f(x) = 1
            if (type.isConstantNode(arg1) && (arg1.value === '0' || arg1.value === '1')) {
              return _fderivative(new ConstantNode('1', config.number), x, alpha, constNodes);
            }

            // TODO: fix
            // d/dx(c^f(x)) = c^f(x)*ln(c)*f'(x)
            //return new OperatorNode('*', 'multiply', [
            //  node,
            //  new OperatorNode('*', 'multiply', [
            //    new FunctionNode('log', [arg1.clone()]),
            //    _fderivative(arg2.clone(), x, alpha, constNodes)
            //  ])
            //]);
            //throw new Error('Power rule not yet supported by fractional derivative.');
          }

          if (constNodes[arg2] !== undefined) {
            if (type.isConstantNode(arg2)) {
              var expValue = arg2.value;

              // If is secretly constant; f(x)^0 = 1 -> d/dx(1) = 0
              if (expValue === '0') {
                return _fderivative(new ConstantNode('1', config.number), x, alpha, constNodes);
              }
              // Ignore exponent; f(x)^1 = f(x)
              if (expValue === '1') {
                return _fderivative(arg1, x, alpha, constNodes);
              }
            }
          }
          // TODO: FIX. FOR NOW ASSUMING ARG2 IS CONST
          // Functional Power Rule, d/dx(f^g) = f^g*[f'*(g/f) + g'ln(f)]
          // Constant Power Rule, d/dx(g(x)^c)
          // chain rule:  F(x)  = f(g(x)) -> F'(x) = gamma(2-a)x^(1-a)/gamma(2)*g'(x)*f'(g(x))
          //F'(x) = x^(a-1)*gamma(2-a)/gamma(2)*g'(x)*gamma(c+1)/gamma(c-a+1)*g(x)^(c-a)
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

  /**
   * Ensures the number of arguments for a function are correct,
   * and will throw an error otherwise.
   *
   * @param {FunctionNode} node
   */
  function funcArgsCheck(node) {
    //TODO add min, max etc
    if ((node.name == 'log' || node.name == 'nthRoot') && node.args.length == 2) {
      return;
    }

    // There should be an incorrect number of arguments if we reach here

    // Change all args to constants to avoid unidentified
    // symbol error when compiling function
    for (var i = 0; i < node.args.length; ++i) {
      node.args[i] = new ConstantNode(0);
    }

    node.compile().eval();
    throw new Error('Expected TypeError, but none found');
  }


  return fderivative;
}

exports.name = 'fderivative';
exports.factory = factory;
