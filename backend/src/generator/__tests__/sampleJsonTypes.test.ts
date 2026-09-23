import { generateSpringBootProject } from '../springBootGenerator';
import AdmZip from 'adm-zip';

describe('Postman sample JSON types', () => {
  it('maps types to representative sample values and uses http base', async () => {
    const uml: any = {
      package: 'com.example.demo',
      classes: [
        {
          name: 'Inventario',
          attributes: [
            { name: 'idInventario', type: 'Integer' },
            { name: 'fecha', type: 'Date' },
            { name: 'ubicacion', type: 'String' },
            { name: 'monto', type: 'Decimal' },
            { name: 'activo', type: 'Boolean' },
            { name: 'hora', type: 'Time' },
            { name: 'momento', type: 'DateTime' }
          ]
        }
      ]
    };

    const buffer = await generateSpringBootProject(uml);
    const zip = new AdmZip(buffer);
    const postman = zip.getEntry('demo/docs/demo-postman-collection.json');
    expect(postman).toBeTruthy();

    const collection = JSON.parse(postman!.getData().toString('utf8'));
    const folder = collection.item.find((i: any) => i.name === 'Inventario');
    expect(folder).toBeTruthy();
    const createReq = folder.item.find((i: any) => /Create Inventario/i.test(i.name));
  expect(createReq.request.url.raw).toContain('http://localhost:8080');

    const body = JSON.parse(createReq.request.body.raw);
    // idInventario excluded from create body
    expect(body.idInventario).toBeUndefined();
    expect(body.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(typeof body.ubicacion).toBe('string');
    expect(typeof body.monto).toBe('number');
    expect(typeof body.activo).toBe('boolean');
    expect(body.hora).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(body.momento).toMatch(/T/);
  });
});
