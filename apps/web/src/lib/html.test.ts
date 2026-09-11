import { describe, expect, it } from 'vitest'
import { htmlSeguro, textoPlanoDeHtml } from './html'

// Estas pruebas corren en node, SIN DOM: cubren el camino de respaldo. La limpieza con DOMPurify
// se comprobó en un navegador real con cargas de ataque (ver docs/REGISTRO_DESPLIEGUES.md).

describe('textoPlanoDeHtml · vista previa del foro', () => {
  it('lo que salía en la captura del foro queda en texto legible', () => {
    expect(textoPlanoDeHtml('<p>Responde&nbsp;con&nbsp;tus&nbsp;propias&nbsp;palabras</p>'))
      .toBe('Responde con tus propias palabras')
  })

  it('quita estilos y etiquetas anidadas del editor', () => {
    const html = '<p><span style="background-color: rgb(255, 255, 255); color: rgb(71, 85, 105);">En&nbsp;este&nbsp;espacio&nbsp;debe&nbsp;presentarse</span></p>'
    expect(textoPlanoDeHtml(html)).toBe('En este espacio debe presentarse')
  })

  it('separa párrafos en vez de pegarlos', () => {
    expect(textoPlanoDeHtml('<p>Hola</p><p>mundo</p>')).toBe('Hola mundo')
  })

  it('decodifica entidades comunes', () => {
    expect(textoPlanoDeHtml('<p>Tom &amp; Jerry &lt;3</p>')).toBe('Tom & Jerry <3')
  })

  it('vacío o nulo devuelve cadena vacía', () => {
    expect(textoPlanoDeHtml(null)).toBe('')
    expect(textoPlanoDeHtml('')).toBe('')
  })
})

describe('htmlSeguro sin DOM', () => {
  it('nunca devuelve HTML crudo: cae a texto plano', () => {
    const r = htmlSeguro('<img src=x onerror="alert(1)"><p>hola</p>')
    expect(r).not.toContain('<')
    expect(r).toBe('hola')
  })
})
