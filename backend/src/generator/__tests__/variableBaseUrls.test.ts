import { generateSpringBootProject } from '../springBootGenerator';
import AdmZip from 'adm-zip';

describe('Postman collection folder layout', () => {
  it('generates a single folder per entity with http base URLs', async () => {
    const uml: any = {
      package: 'com.example.demo',
      classes: [
        { name: 'Foo', attributes: [ { name: 'idFoo', type: 'Long' }, { name: 'name', type: 'String' } ], relations: [] }
      ]
    };

    const buffer = await generateSpringBootProject(uml);
    const zip = new AdmZip(buffer);
    const postmanEntry = zip.getEntry('demo/docs/demo-postman-collection.json');
    expect(postmanEntry).toBeTruthy();

    const collection = JSON.parse(postmanEntry!.getData().toString('utf8'));
    const fixedFolder = collection.item.find((i: any) => i.name === 'Foo');
    const varFolder = collection.item.find((i: any) => i.name === 'Foo (Variable Base)');

    expect(fixedFolder).toBeTruthy();
    expect(varFolder).toBeUndefined();

    const createFixed = fixedFolder.item.find((i: any) => /Create Foo/i.test(i.name));
    expect(createFixed.request.url.raw).toContain('http://localhost:8080/api/foos');
  });
});
