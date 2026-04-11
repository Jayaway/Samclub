import { createRouter, createWebHistory } from 'vue-router';
import { useUserStore } from '../stores/user';
import Login from '../views/Login.vue';
import Square from '../views/Square.vue';
import Create from '../views/Create.vue';
import Detail from '../views/Detail.vue';
import Shop from '../views/Shop.vue';
import My from '../views/My.vue';
import Profile from '../views/Profile.vue';

const routes = [
  {
    path: '/',
    redirect: '/square'
  },
  {
    path: '/login',
    name: 'Login',
    component: Login
  },
  {
    path: '/square',
    name: 'Square',
    component: Square,
    meta: { requiresAuth: true }
  },
  {
    path: '/create',
    name: 'Create',
    component: Create,
    meta: { requiresAuth: true }
  },
  {
    path: '/detail/:id',
    name: 'Detail',
    component: Detail,
    meta: { requiresAuth: true }
  },
  {
    path: '/shop/:id',
    name: 'Shop',
    component: Shop,
    meta: { requiresAuth: true }
  },
  {
    path: '/my',
    name: 'My',
    component: My,
    meta: { requiresAuth: true }
  },
  {
    path: '/profile',
    name: 'Profile',
    component: Profile,
    meta: { requiresAuth: true }
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach((to, from, next) => {
  const userStore = useUserStore();

  if (to.meta.requiresAuth && !userStore.isLoggedIn) {
    next('/login');
  } else {
    next();
  }
});

export default router;
