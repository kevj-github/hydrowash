/**
 * @name InfoWindow content built from an interpolated template literal
 * @description Google Maps InfoWindow parses a string `content` as HTML. Booking data
 *              is customer-controlled, so interpolating it here is an XSS sink.
 * @kind problem
 * @problem.severity error
 * @security-severity 8.0
 * @id js/hydrowash/infowindow-html-interpolation
 * @tags security external/cwe/cwe-079
 */
import javascript

from NewExpr ne, ObjectExpr obj, Property p, TemplateLiteral t
where
  ne.getCalleeName() = "InfoWindow" and
  obj = ne.getAnArgument() and
  p = obj.getAProperty() and
  p.getName() = "content" and
  t = p.getInit() and
  exists(Expr e | e = t.getAnElement() and not e instanceof TemplateElement)
select p, "InfoWindow content is built by string interpolation; customer-controlled data reaches an HTML sink."
