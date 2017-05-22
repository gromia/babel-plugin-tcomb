/*! @preserve
 *
 * babel-plugin-tcomb - Babel plugin for static and runtime type checking using Flow and tcomb
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2016 Giulio Canti
 *
 */

import generate from 'babel-generator'

const PLUGIN_NAME = 'babel-plugin-tcomb'
const TCOMB_DIRECTIVE = "@tcomb";
const REFINEMENT_PREDICATE_ID_STORE_FIELD = '__babel_plugin_tcomb_refinementPredicateIdStoreField'

const flowMagicTypes = {
  '$Shape': true,
  '$Keys': true,
  '$Diff': true,
  '$Abstract': true,
  '$Subtype': true,
  '$ObjMap': true
}

// plugin magic types
const MAGIC_REFINEMENT_NAME = '$Refinement'
const MAGIC_REIFY_NAME = '$Reify'
const RESERVED_NAMES = {
  [MAGIC_REFINEMENT_NAME]: true,
  [MAGIC_REIFY_NAME]: true
}

// plugin config

const WARN_ON_FAILURE_OPTION = 'warnOnFailure'

function assign(x, y) {
  if (y) {
    for (let k in y) {
      x[k] = y[k]
    }
  }
  return x
}

export default function ({ types: t, template }) {

  let tcombId = null
  let assertId = null
  let extendId = null
  let hasTcombDirective = false
  let globals

  // combinators

  function addTypeName(combinatorArguments, typeName, exact) {
    if (t.isStringLiteral(typeName)) {
      if (exact) {
        combinatorArguments.push(t.objectExpression([
          t.objectProperty(t.identifier('name'), typeName),
          t.objectProperty(t.identifier('strict'), t.booleanLiteral(true))
        ]))
      }
      else {
        combinatorArguments.push(typeName)
      }
    }
    else if (exact) {
      combinatorArguments.push(t.objectExpression([
        t.objectProperty(t.identifier('strict'), t.booleanLiteral(true))
      ]))
    }
    return combinatorArguments
  }

  function callCombinator(combinatorId, combinatorArguments, typeName) {
    return t.callExpression(
      t.memberExpression(tcombId, combinatorId),
      addTypeName(combinatorArguments, typeName)
    )
  }

  const listId = t.identifier('list')
  const tupleId = t.identifier('tuple')
  const maybeId = t.identifier('maybe')
  const unionId = t.identifier('union')
  const dictId = t.identifier('dict')
  const refinementId = t.identifier('refinement')
  const interfaceId = t.identifier('interface')
  const declareId = t.identifier('declare')
  const intersectionId = t.identifier('intersection')
  const functionId = t.identifier('Function')
  const objectId = t.identifier('Object')
  const nilId = t.identifier('Nil')
  const numberId = t.identifier('Number')
  const stringId = t.identifier('String')
  const booleanId = t.identifier('Boolean')
  const anyId = t.identifier('Any')

  function getEmptyType() {
    return t.callExpression(
      t.memberExpression(tcombId, t.identifier('irreducible')),
      [
        t.stringLiteral('Empty'),
        t.functionExpression(null, [], t.blockStatement([
          t.returnStatement(
            t.booleanLiteral(false)
          )
        ]))
      ]
    )
  }

  function getListCombinator(type, name) {
    return callCombinator(listId, [type], name)
  }

  function getMaybeCombinator(type, name) {
    return callCombinator(maybeId, [type], name)
  }

  function getTupleCombinator(types, name) {
    return callCombinator(tupleId, [t.arrayExpression(types)], name)
  }

  function getUnionCombinator(types, name) {
    return callCombinator(unionId, [t.arrayExpression(types)], name)
  }

  function getEnumsCombinator(enums, name) {
    return t.callExpression(
      t.memberExpression(t.memberExpression(tcombId, t.identifier('enums')), t.identifier('of')),
      addTypeName([t.arrayExpression(enums.map(e => t.stringLiteral(e)))], name)
    )
  }

  function getDictCombinator(domain, codomain, name) {
    return callCombinator(dictId, [domain, codomain], name)
  }

  function getRefinementCombinator(type, predicate, name) {
    return callCombinator(refinementId, [type, predicate], name)
  }

  function getInterfaceCombinator(props, name, exact) {
    return t.callExpression(
      t.memberExpression(tcombId, interfaceId),
      addTypeName([props], name, exact)
    )
  }

  function getDeclareCombinator(name) {
    return callCombinator(declareId, [name])
  }

  function getIntersectionCombinator(types, name) {
    const intersections = types.filter(t => !(t[REFINEMENT_PREDICATE_ID_STORE_FIELD]))
    const refinements = types.filter(t => t[REFINEMENT_PREDICATE_ID_STORE_FIELD])
    let intersection = intersections.length > 1 ?
      t.callExpression(
        t.memberExpression(tcombId, intersectionId),
        addTypeName([t.arrayExpression(intersections)], name)
      ) :
      intersections[0]
    const len = refinements.length
    if (len > 0) {
      for (let i = 0; i < len; i++) {
        intersection = getRefinementCombinator(intersection, refinements[i][REFINEMENT_PREDICATE_ID_STORE_FIELD], name)
      }
    }
    return intersection
  }

  //
  // Flow types
  //

  function getTcombType(id) {
    return t.memberExpression(tcombId, id)
  }

  function getFunctionType() {
    return getTcombType(functionId)
  }

  function getObjectType() {
    return getTcombType(objectId)
  }

  function getNumberType() {
    return getTcombType(numberId)
  }

  function getStringType() {
    return getTcombType(stringId)
  }

  function getBooleanType() {
    return getTcombType(booleanId)
  }

  function getVoidType() {
    return getTcombType(nilId)
  }

  function getNullType() {
    return getTcombType(nilId)
  }

  function getAnyType() {
    return getTcombType(anyId)
  }

  function getNumericLiteralType(value) {
    const n = t.identifier('n')
    const predicate = t.functionExpression(null, [n], t.blockStatement([
      t.returnStatement(
        t.binaryExpression(
          '===',
          n,
          t.numericLiteral(value)
        )
      )
    ]))
    return getRefinementCombinator(getNumberType(), predicate)
  }

  function getBooleanLiteralType(value) {
    const b = t.identifier('b')
    const type = getBooleanType()
    const predicate = t.functionExpression(null, [b], t.blockStatement([
      t.returnStatement(
        t.binaryExpression(
          '===',
          b,
          t.booleanLiteral(value)
        )
      )
    ]))
    return getRefinementCombinator(type, predicate)
  }

  //
  // helpers
  //

  function getExpression(node) {
    return t.isExpressionStatement(node) ? node.expression : node
  }

  function expression(input) {
    const fn = template(input)
    return function (args) {
      const node = fn(args)
      return getExpression(node)
    }
  }

  function getObjectExpression(properties, typeParameters) {
    const props = properties
      .map(prop => {
        let type = getType(prop.value, typeParameters)
        if (prop.optional) {
          type = getMaybeCombinator(type)
        }
        return t.objectProperty(prop.key, type)
      })
    return t.objectExpression(props)
  }

  function getExpressionFromGenericTypeAnnotation(id) {
    if (t.isQualifiedTypeIdentifier(id)) {
      return t.memberExpression(getExpressionFromGenericTypeAnnotation(id.qualification), t.identifier(id.id.name))
    }
    return id
  }

  function getRefinementPredicateId(annotation) {
    if (annotation.typeParameters.params.length !== 1 || !annotation.typeParameters.params[0].argument) {
      throw new Error(`Invalid refinement definition, example: $Refinement<typeof predicate>`)
    }
    return getExpressionFromGenericTypeAnnotation(annotation.typeParameters.params[0].argument.id)
  }

  function isTypeParameter(name, typeParameters) {
    return typeParameters && typeParameters.hasOwnProperty(name)
  }

  function isGlobalType(name) {
    return globals && globals.hasOwnProperty(name)
  }

  function shouldReturnAnyType(name, typeParameters) {
     // this plugin doesn't handle generics by design
    return isGlobalType(name) || isTypeParameter(name, typeParameters) || flowMagicTypes.hasOwnProperty(name)
  }

  function getGenericTypeAnnotation(annotation, typeParameters, typeName) {
    const name = annotation.id.name
    if (name === 'Array') {
      if (!annotation.typeParameters || annotation.typeParameters.params.length !== 1) {
        throw new Error(`Unsupported Array type annotation: incorrect number of type parameters (expected 1)`)
      }
      const typeParameter = annotation.typeParameters.params[0]
      return getListCombinator(getType(typeParameter, typeParameters), typeName)
    }
    if (name === 'Function') {
      return getFunctionType()
    }
    if (name === 'Object') {
      return getObjectType()
    }
    if (name === '$Exact') {
      return getInterfaceCombinator(getObjectExpression(annotation.typeParameters.params[0].properties, typeParameters), typeName, true)
    }
    if (shouldReturnAnyType(name, typeParameters)) {
      return getAnyType()
    }
    const gta = getExpressionFromGenericTypeAnnotation(annotation.id)
    if (name === MAGIC_REFINEMENT_NAME) {
      gta[REFINEMENT_PREDICATE_ID_STORE_FIELD] = getRefinementPredicateId(annotation)
    }
    return gta
  }

  function getType(annotation, typeParameters, typeName) {
    switch (annotation.type) {

      case 'GenericTypeAnnotation' :
        return getGenericTypeAnnotation(annotation, typeParameters, typeName)

      case 'ArrayTypeAnnotation' :
        return getListCombinator(getType(annotation.elementType, typeParameters), typeName)

      case 'NullableTypeAnnotation' :
        return getMaybeCombinator(getType(annotation.typeAnnotation, typeParameters), typeName)

      case 'TupleTypeAnnotation' :
        return getTupleCombinator(annotation.types.map(annotation => getType(annotation, typeParameters)), typeName)

      case 'UnionTypeAnnotation' :
        // handle enums
        if (annotation.types.every(n => t.isStringLiteralTypeAnnotation(n))) {
          return getEnumsCombinator(annotation.types.map(n => n.value), typeName)
        }
        return getUnionCombinator(annotation.types.map(annotation => getType(annotation, typeParameters)), typeName)

      case 'ObjectTypeAnnotation' :
        if (annotation.indexers.length === 1) {
          return getDictCombinator(
            getType(annotation.indexers[0].key, typeParameters),
            getType(annotation.indexers[0].value, typeParameters),
            typeName
          )
        }
        return getInterfaceCombinator(getObjectExpression(annotation.properties, typeParameters), typeName, annotation.exact)

      case 'IntersectionTypeAnnotation' :
        return getIntersectionCombinator(annotation.types.map(annotation => getType(annotation, typeParameters)), typeName)

      case 'FunctionTypeAnnotation' :
        return getFunctionType()

      case 'NumberTypeAnnotation' :
        return getNumberType()

      case 'StringTypeAnnotation' :
        return getStringType()

      case 'BooleanTypeAnnotation' :
        return getBooleanType()

      case 'VoidTypeAnnotation' :
        return getVoidType()

      case 'NullLiteralTypeAnnotation' :
        return getNullType()

      case 'TypeofTypeAnnotation' :
      case 'AnyTypeAnnotation' :
      case 'MixedTypeAnnotation' :
      case 'ExistentialTypeParam' :
        return getAnyType()

      case 'StringLiteralTypeAnnotation' :
        return getEnumsCombinator([annotation.value], typeName)

      case 'NumericLiteralTypeAnnotation' :
        return getNumericLiteralType(annotation.value, typeName)

      case 'BooleanLiteralTypeAnnotation' :
        return getBooleanLiteralType(annotation.value, typeName)

      case 'EmptyTypeAnnotation' :
        return getEmptyType()

      default :
        throw new Error(`Unsupported type annotation: ${annotation.type}`)
    }
  }

  function buildCodeFrameError(path, error) {
    throw path.buildCodeFrameError(`[${PLUGIN_NAME}] ${error.message}`)
  }

  function preventReservedNamesUsage(path) {
    const name = path.node.id.name
    if (name in RESERVED_NAMES) {
      buildCodeFrameError(path, new Error(`${name} is a reserved interface name for ${PLUGIN_NAME}`))
    }
  }

  function hasRecursiveComment(node) {
    return Array.isArray(node.leadingComments) && node.leadingComments.some(comment => /recursive/.test(comment.value))
  }

  function isRecursiveType(node) {
    return node[IS_RECURSIVE_STORE_FIELD] || hasRecursiveComment(node)
  }

  function isExternalImportDeclaration(source) {
    return !(source.indexOf('./') === 0 || source.indexOf('../') === 0)
  }

  function getExternalImportDeclaration(path) {
    const node = path.node
    const source = node.source.value
    const typesId = path.scope.generateUidIdentifier(source)
    const importNode = t.importDeclaration([
      t.importNamespaceSpecifier(typesId)
    ], t.stringLiteral(source))
    return [importNode].concat(node.specifiers.map(specifier => {
      const isDefaultImport = specifier.type === 'ImportDefaultSpecifier'
      return t.variableDeclaration('const', [
        t.variableDeclarator(
          specifier.local,
          t.logicalExpression(
            '||',
            t.memberExpression(typesId, isDefaultImport ? t.identifier('default') : specifier.imported),
            getAnyType()
          )
        )
      ])
    }))
  }

  function isTypeExportNamedDeclaration(node) {
    return node.declaration && ( t.isTypeAlias(node.declaration) || t.isInterfaceDeclaration(node.declaration) )
  }

  function getTypeParameterName(param) {
    if (t.isGenericTypeAnnotation(param)) {
      return param.id.name
    }
    return param.name
  }

  function getTypeParameters(node) {
    const typeParameters = {}
    if (node.typeParameters) {
      node.typeParameters.params.forEach(param => typeParameters[getTypeParameterName(param)] = true)
    }
    return typeParameters
  }

  function getTypeAliasDefinition(path) {
    const node = path.node
    const typeParameters = getTypeParameters(node)
    const annotation = node.right

    const typeName = t.stringLiteral(node.id.name);

    return t.variableDeclaration('const', [
      t.variableDeclarator(
        node.id,
        getType(annotation, typeParameters, typeName)
      )
    ])
  }

  //
  // visitors
  //

  return {
    visitor: {

      Program: {
        enter(path, state) {
          hasTcombDirective = false
          tcombId = path.scope.generateUidIdentifier('t')
          assertId = path.scope.generateUidIdentifier('assert')
          extendId = path.scope.generateUidIdentifier('extend')

          state.file.ast.comments.forEach(comment => {
            if (comment.value.indexOf(TCOMB_DIRECTIVE) >= 0) {
              hasTcombDirective = true
              // remove tcomb directive
              comment.value = comment.value.replace(TCOMB_DIRECTIVE, "");

              // remove the comment completely if it only consists of whitespace and/or stars
              if (!comment.value.replace(/\*/g, "").trim()) {
                comment.ignore = true;
              }
            }
          });

          if (!globals && state.opts.globals) {
            globals = state.opts.globals.reduce((acc, x) => assign(acc, x), {})
          }
        },

        exit(path, state) {
          const isImportTcombRequired = hasTcombDirective;

          if (isImportTcombRequired) {
            path.node.body.unshift(
              t.importDeclaration([
                t.importDefaultSpecifier(tcombId)],
                t.stringLiteral('tcomb')
              )
            )
          }
        }

      },

      TypeAlias(path) {
        if (!hasTcombDirective) {
          return;
        }

        preventReservedNamesUsage(path)
        path.replaceWith(getTypeAliasDefinition(path))
      },

      ExportNamedDeclaration(path) {
        if (!hasTcombDirective) {
          return;
        }

        const node = path.node
        // prevent transform-flow-strip-types
        if (isTypeExportNamedDeclaration(node)) {
          node.exportKind = 'value'
        }
      },

      ImportDeclaration(path) {
        if (!hasTcombDirective) {
          return;
        }

        const node = path.node
        if (node.importKind === 'type') {
          const source = node.source.value
          if (isExternalImportDeclaration(source)) {
            hasTypes = true
            path.replaceWithMultiple(getExternalImportDeclaration(path))
          }
          else {
            // prevent transform-flow-strip-types
            node.importKind = 'value'
          }
        }
      },
    }
  }
}
