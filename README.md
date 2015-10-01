# datasource.js

The ultimate way to interact with RESTFull backends from javascript clients.

## Install

You can install this package with `bower`.

### bower

```shell
bower install datasourcejs
```

Import the js library to your page:

```html
<script src="bower-components/datasourcejs/dist/datasource.js"></script>
```

Then you can use `datasource` diretive to handle RESTFull requests:

```html
<datasource 
    name="Users" 
    entity="http://jsonplaceholder.typicode.com/users" 
    keys="id" 
    rows-per-page="-1">
</datasource>
```

The datasource diretive will handle the following actions

| Request  | Url |
| ------------- | ------------- |
| GET  | /entity  |
| POST  | /entity  |
| PUT  | /entity/{ID}  |
| DELETE  | /entity{ID}  |

## Roadmap

- Support for secure requests
- Unit test case
