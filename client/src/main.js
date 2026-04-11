import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import {
  Button,
  Form,
  Field,
  CellGroup,
  Cell,
  NavBar,
  Tabbar,
  TabbarItem,
  List,
  Card,
  Progress,
  Icon,
  PullRefresh,
  Empty,
  Stepper,
  Divider,
  Popup,
  Uploader,
  Switch,
  Dialog,
  Toast
} from 'vant';
import 'vant/lib/index.css';
import './style.css';

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(Button);
app.use(Form);
app.use(Field);
app.use(CellGroup);
app.use(Cell);
app.use(NavBar);
app.use(Tabbar);
app.use(TabbarItem);
app.use(List);
app.use(Card);
app.use(Progress);
app.use(Icon);
app.use(PullRefresh);
app.use(Empty);
app.use(Stepper);
app.use(Divider);
app.use(Popup);
app.use(Uploader);
app.use(Switch);
app.use(Dialog);
app.use(Toast);

app.mount('#app');
