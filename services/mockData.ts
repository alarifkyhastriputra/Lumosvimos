
import { User, Post } from '../types';

export const initialUsers: User[] = [
  {
    id: 'u1',
    name: 'Aiden Shadows',
    email: 'aiden@vimos.com',
    bio: 'Finding beauty in the absence of color.',
    photoURL: 'https://picsum.photos/200/200?grayscale&random=1',
    followers: ['u2', 'u3'],
    following: ['u2'],
    totalLikes: 450
  },
  {
    id: 'u2',
    name: 'Luna Black',
    email: 'luna@vimos.com',
    bio: 'Architect of darkness. Monochrome enthusiast.',
    photoURL: 'https://picsum.photos/200/200?grayscale&random=2',
    followers: ['u1'],
    following: ['u1', 'u3'],
    totalLikes: 890
  },
  {
    id: 'u3',
    name: 'Grey Wanderer',
    email: 'grey@vimos.com',
    bio: 'Street photography from the soul.',
    photoURL: 'https://picsum.photos/200/200?grayscale&random=3',
    followers: ['u2'],
    following: ['u1'],
    totalLikes: 120
  }
];

export const initialPosts: Post[] = [
  {
    id: 'p1',
    userId: 'u1',
    userName: 'Aiden Shadows',
    userPhoto: 'https://picsum.photos/200/200?grayscale&random=1',
    text: 'Tokyo at night is just a series of contrasting lights.',
    photoURL: 'https://picsum.photos/600/400?grayscale&random=11',
    timestamp: Date.now() - 3600000,
    likes: ['u2'],
    dislikes: [],
    comments: [
      { id: 'c1', userId: 'u2', userName: 'Luna Black', text: 'Stunning contrast!', timestamp: Date.now() - 1800000 }
    ]
  },
  {
    id: 'p2',
    userId: 'u2',
    userName: 'Luna Black',
    userPhoto: 'https://picsum.photos/200/200?grayscale&random=2',
    text: 'Sometimes silence is the loudest color.',
    timestamp: Date.now() - 7200000,
    likes: ['u1', 'u3'],
    dislikes: [],
    comments: []
  }
];
