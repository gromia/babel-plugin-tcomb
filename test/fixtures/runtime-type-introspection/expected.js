import _t from 'tcomb';

const U = _t.enums.of(['foo', 'bar', 'baz'], 'U');

export const Person = _t.interface({
  id: _t.Number,
  dob: Date,
  firstName: _t.String,
  lastName: _t.String,
  u: U
}, 'Person');
