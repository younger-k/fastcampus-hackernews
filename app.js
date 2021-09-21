const ajax = new XMLHttpRequest();
const NEWS_URL = 'https://api.hnpwa.com/v0/news/1.json';

ajax.open('GET', NEWS_URL, false);  // 동기적으로 데이터 가져오겠음.
ajax.send();

const newsFeed = JSON.parse(ajax.response);
const ul = document.createElement('ul');

for(let i = 0; i < 10; i++) {
  const li = document.createElement('li');
  li.innerHTML = `<li>${newsFeed[i].title}</li>`;
  ul.appendChild(li);
}

document.getElementById('root').appendChild(ul);