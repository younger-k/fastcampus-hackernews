/**
 * <typing 방법>
 * 1. type alias
 * type NewsFeed = News & {
 *   comments_count: number;
 *   points: number;
 *   read?: boolean;
 * }
 * 
 * 2. interface
 * interface NewsFeed extends News {
 *   comments_count: number;
 *   points: number;
 *   read?: boolean;
 * }
 * 
 * type alias와 interface 간 기능상의 특별한 차이는 없다.
 * 문법의 차이만 조금 있을 뿐이고 원하는 것을 선택하여 일관성 있는 코드를 작성하도록 하자.
 * 
 * 확장형의 타입은 인터페이스를 선호하는 경향 있다.
 * 유니온 타입(|)은 type alias만 지원! ex. type Type = 'a' | 'b'
 */

interface Store {
  currentPage: number;
  feeds: NewsFeed[];
}

interface News {
  readonly id: number;  // 해당 필드를 코드 상에서 수정이 불가하도록 함!
  user: string;
  time_ago: string;
  title: string;
  url: string;
  content: string;
}

interface NewsFeed extends News {
  comments_count: number;
  points: number;
  read?: boolean;
}

interface NewsDetail extends News {
  comments: NewsComment[];
}

interface NewsComment extends News {
  comments: NewsComment[];
  level: number;
}

interface RouteInfo {
  path: string;
  page: View;
}

const container: HTMLElement | null = document.getElementById('root');
const ajax: XMLHttpRequest = new XMLHttpRequest();
const NEWS_URL = 'https://api.hnpwa.com/v0/news/1.json';
const CONTENT_URL = 'https://api.hnpwa.com/v0/item/@id.json';
const store: Store = {
  currentPage: 1,
  feeds: [],
};

/**
 * 다음과 같은 유니언을 이용한 리턴값 명시는 어떤 반환값이 나오는지 모호하다.
 * 리턴값으로 지네릭을 사용하도록 하자!
 * 지네릭을 사용하면 호출 시, 리턴 값을 정해줄 수 있다.
 * 
  function getData(url: string): NewsFeed[] | NewsDetail {
    ajax.open('GET', url, false);
    ajax.send();

    return JSON.parse(ajax.response);
  }
 */

 /**
  * baseClass를 targetClass로 상속 시킨다.
  * 
  * 문법적으로 상속을 제공하는데 왜 믹스인을 사용해야 할까?
  * 1. 기존의 extends는 코드에 무조건 적시해주어야 해서 수정비용이 들어감
  * 2. 다중상속을 지원할 수 있게 해준다.
  * 
  * @param targetClass 자식 클래스 
  * @param baseClass 부모 클래스
  */
function applyApiMixins(targetClass: any, baseClasses: any[]) {
  baseClasses.forEach(baseClass => {
    Object.getOwnPropertyNames(baseClass.prototype).forEach(name => {
      const descriptor = Object.getOwnPropertyDescriptor(baseClass.prototype, name);

      if (descriptor) {
        Object.defineProperty(targetClass.prototype, name, descriptor);
      }
    })
  })
}

class Api {
  getRequest<AjaxResponse>(url: string): AjaxResponse {
    const ajax = new XMLHttpRequest();
    ajax.open('GET', url, false);
    ajax.send();

    return JSON.parse(ajax.response);
  }
}

class NewsFeedApi {
  getData(): NewsFeed[] {
    return this.getRequest<NewsFeed[]>(NEWS_URL);
  }
}

class NewsDetailApi {
  getData(id: string): NewsDetail {
    return this.getRequest<NewsDetail>(CONTENT_URL.replace('@id', id));
  }
}

function getData<AjaxResponse>(url: string): AjaxResponse {
  ajax.open('GET', url, false);
  ajax.send();

  return JSON.parse(ajax.response);
}

// 컴파일러는 믹스인까지는 추적하지 못하여 추가
interface NewsFeedApi extends Api {}
interface NewsDetailApi extends Api {}

applyApiMixins(NewsFeedApi, [Api]);
applyApiMixins(NewsDetailApi, [Api]);

abstract class View {
  private template: string;
  private renderTemplate: string;
  private container: HTMLElement;
  private htmlList: string[];

  constructor(containerId: string, template: string) {
    const containerElement = document.getElementById(containerId);

    if(!containerElement) {
      throw '최상위 컨테이너가 없어 UI를 진행하지 못합니다.'
    }

    this.container = containerElement;
    this.template = template;
    this.renderTemplate = template
    this.htmlList = [];
  }

  protected updateView(): void {
    this.container.innerHTML = this.renderTemplate;
    this.renderTemplate = this.template;
  }

  protected addHtml(htmlString: string): void {
    this.htmlList.push(htmlString);
  }

  protected getHtml(): string {
    const snapshot = this.htmlList.join('');
    this.clearHtmlList();
    return snapshot;
  }

  protected setTemplateData(key: string, value: string): void {
    this.renderTemplate = this.renderTemplate.replace(`{{__${key}__}}`, value);
  }

  private clearHtmlList(): void {
    this.htmlList = [];
  }

  /**
   * 추상 메서드 : 자식 클래스에게 구현을 강제
   */
  abstract render(): void;
}

class NewsFeedView extends View {
  private api: NewsFeedApi;
  private feeds: NewsFeed[];

  constructor(container: string) {
    let template = `
      <div class="bg-gray-600 min-h-screen">
        <div class="bg-white text-xl">
          <div class="mx-auto px-4">
            <div class="flex justify-between items-center py-6">
              <div class="flex justify-start">
                <h1 class="font-extrabold">Hacker News</h1>
              </div>
              <div class="items-center justify-end">
                <a href="#/page/{{__prev_page__}}" class="text-gray-500">
                  Previous
                </a>
                <a href="#/page/{{__next_page__}}" class="text-gray-500 ml-4">
                  Next
                </a>
              </div>
            </div> 
          </div>
        </div>
        <div class="p-4 text-2xl text-gray-700">
          {{__news_feed__}}        
        </div>
      </div>
    `;

    super(container, template)

    this.api = new NewsFeedApi();
    this.feeds = store.feeds;

    if (this.feeds.length === 0) {
      this.feeds = store.feeds = this.api.getData();
      this.makeFeeds();
    }
  }

  private makeFeeds(): void {
    /**
     * 타입 추론을 통해 반복문의 i는 number 타입을 지정하지 않아도 된다.
     * 컴파일러가 타입 추론을 통해 자체적으로 판단한다.
     */
    for (let i = 0; i < this.feeds.length; i++) {
      this.feeds[i].read = false;
    }
  }

  render(): void {
    store.currentPage = Number(location.hash.substr(7) || 1);

    for(let i = (store.currentPage - 1) * 10; i < store.currentPage * 10; i++) {
      const { id, title, comments_count, user, points, time_ago, read } = this.feeds[i];  // 구조분해할당
      this.addHtml(`
        <div class="p-6 ${read ? 'bg-red-500' : 'bg-white'} mt-6 rounded-lg shadow-md transition-colors duration-500 hover:bg-green-100">
          <div class="flex">
            <div class="flex-auto">
              <a href="#/show/${id}">${title}</a>  
            </div>
            <div class="text-center text-sm">
              <div class="w-10 text-white bg-green-300 rounded-lg px-0 py-2">${comments_count}</div>
            </div>
          </div>
          <div class="flex mt-3">
            <div class="grid grid-cols-3 text-sm text-gray-500">
              <div><i class="fas fa-user mr-1"></i>${user}</div>
              <div><i class="fas fa-heart mr-1"></i>${points}</div>
              <div><i class="far fa-clock mr-1"></i>${time_ago}</div>
            </div>  
          </div>
        </div>
      `);
    }

    this.setTemplateData('news_feed', this.getHtml());
    this.setTemplateData('prev_page', String(store.currentPage > 1 ? store.currentPage - 1 : 1));
    this.setTemplateData('next_page', String(store.currentPage < 3 ? store.currentPage + 1 : 3));

    this.updateView();
  }
}

class NewsDetailView extends View {
  constructor(containerId: string) {
    let template = `
      <div class="bg-gray-600 min-h-screen pb-8">
        <div class="bg-white text-xl">
          <div class="mx-auto px-4">
            <div class="flex justify-between items-center py-6">
              <div class="flex justify-start">
                <h1 class="font-extrabold">Hacker News</h1>
              </div>
              <div class="items-center justify-end">
                <a href="#/page/{{__current_page__}}" class="text-gray-500">
                  <i class="fa fa-times"></i>
                </a>
              </div>
            </div>
          </div>
        </div>
  
        <div class="h-full border rounded-xl bg-white m-6 p-4 ">
          <h2>{{__title__}}</h2>
          <div class="text-gray-400 h-20">
            {{__content__}}
          </div>
  
          {{__comments__}}
  
        </div>
      </div>
    `;

    super(containerId, template);
  }

  private makeComment(comments: NewsComment[]): string {
    for (let i = 0; i < comments.length; i++) {
      const comment: NewsComment = comments[i];
  
      this.addHtml(`
        <div style="padding-left: ${comment.level * 40}px;" class="mt-4">
          <div class="text-gray-400">
            <i class="fa fa-sort-up mr-2"></i>
            <strong>${comment.user}</strong> ${comment.time_ago}
          </div>
          <p class="text-gray-700">${comment.content}</p>
        </div>
      `);
  
      if (comment.comments.length > 0) {
        this.addHtml(this.makeComment(comment.comments));
      }
    }
  
    return this.getHtml();
  }

  render() {
    const id = location.hash.substr(7);
    const api = new NewsDetailApi();
    const newsContent = api.getData(id);
    
    for (let i = 0; i < store.feeds.length; i++) {
      if(store.feeds[i].id === Number(id)) {
        store.feeds[i].read = true;
        break;
      }
    }
    
    this.setTemplateData('comments', this.makeComment(newsContent.comments));
    this.setTemplateData('current_page', String(store.currentPage));
    this.setTemplateData('title', newsContent.title);
    this.setTemplateData('content', newsContent.content);

    this.updateView();
  }
}

class Router {
  routeTable: RouteInfo[];
  defaultRoute: RouteInfo | null;

  constructor() {
    // 브라우저의 이벤트 시스템이 호출하는게 default이기 때문에 binding을 꼭 해주어야 함.
    window.addEventListener('hashchange', this.route.bind(this));

    this.routeTable = [];
    this.defaultRoute = null;
  }

  setDefaultPage(page: View): void {
    this.defaultRoute = { path: '', page };
  }

  addRoutePath(path: string, page: View): void {
    this.routeTable.push({ path, page});
  }

  route() {
    const routePath = location.hash;

    if (routePath === '' && this.defaultRoute) {
      this.defaultRoute.page.render();
    }

    for (const routeInfo of this.routeTable) {
      if (routePath.indexOf(routeInfo.path) >= 0) {
        routeInfo.page.render();
        break;
      }
    }
  }
}

const router: Router = new Router();
const newsFeedView = new NewsFeedView('root');
const newsDetailView = new NewsDetailView('root');

router.setDefaultPage(newsFeedView);

router.addRoutePath('/page/', newsFeedView);
router.addRoutePath('/show/', newsDetailView);

router.route();





// function updateView(html: string): void {
//   if (container)  // 타입 가드
//     container.innerHTML = html;
//   else
//     console.error('최상위 컨테이너가 존재하지 않습니다.');
// }

// function newsFeed(): void {
//   const api = new NewsFeedApi();
//   let newsFeed: NewsFeed[] = store.feeds;
//   const newsList = [];
//   let template = `
//     <div class="bg-gray-600 min-h-screen">
//       <div class="bg-white text-xl">
//         <div class="mx-auto px-4">
//           <div class="flex justify-between items-center py-6">
//             <div class="flex justify-start">
//               <h1 class="font-extrabold">Hacker News</h1>
//             </div>
//             <div class="items-center justify-end">
//               <a href="#/page/{{__prev_page__}}" class="text-gray-500">
//                 Previous
//               </a>
//               <a href="#/page/{{__next_page__}}" class="text-gray-500 ml-4">
//                 Next
//               </a>
//             </div>
//           </div> 
//         </div>
//       </div>
//       <div class="p-4 text-2xl text-gray-700">
//         {{__news_feed__}}        
//       </div>
//     </div>
//   `;

//   if (newsFeed.length === 0) {
//     newsFeed = store.feeds = makeFeeds(api.getData());
//   }

//   for(let i = (store.currentPage - 1) * 10; i < store.currentPage * 10; i++) {
//     newsList.push(`
//       <div class="p-6 ${newsFeed[i].read ? 'bg-red-500' : 'bg-white'} mt-6 rounded-lg shadow-md transition-colors duration-500 hover:bg-green-100">
//         <div class="flex">
//           <div class="flex-auto">
//             <a href="#/show/${newsFeed[i].id}">${newsFeed[i].title}</a>  
//           </div>
//           <div class="text-center text-sm">
//             <div class="w-10 text-white bg-green-300 rounded-lg px-0 py-2">${newsFeed[i].comments_count}</div>
//           </div>
//         </div>
//         <div class="flex mt-3">
//           <div class="grid grid-cols-3 text-sm text-gray-500">
//             <div><i class="fas fa-user mr-1"></i>${newsFeed[i].user}</div>
//             <div><i class="fas fa-heart mr-1"></i>${newsFeed[i].points}</div>
//             <div><i class="far fa-clock mr-1"></i>${newsFeed[i].time_ago}</div>
//           </div>  
//         </div>
//       </div>
//     `);
//   }

//   template = template.replace('{{__news_feed__}}', newsList.join(''));
//   template = template.replace('{{__prev_page__}}', String(store.currentPage > 1 ? store.currentPage - 1 : 1));
//   template = template.replace('{{__next_page__}}', String(store.currentPage < 3 ? store.currentPage + 1 : 3));

//   updateView(template);
// }

// function newsDetail(): void {
//   const id = location.hash.substr(7);
//   const api = new NewsDetailApi();
//   const newsContent = api.getData(id);
//   let template = `
//     <div class="bg-gray-600 min-h-screen pb-8">
//       <div class="bg-white text-xl">
//         <div class="mx-auto px-4">
//           <div class="flex justify-between items-center py-6">
//             <div class="flex justify-start">
//               <h1 class="font-extrabold">Hacker News</h1>
//             </div>
//             <div class="items-center justify-end">
//               <a href="#/page/${store.currentPage}" class="text-gray-500">
//                 <i class="fa fa-times"></i>
//               </a>
//             </div>
//           </div>
//         </div>
//       </div>

//       <div class="h-full border rounded-xl bg-white m-6 p-4 ">
//         <h2>${newsContent.title}</h2>
//         <div class="text-gray-400 h-20">
//           ${newsContent.content}
//         </div>

//         {{__comments__}}

//       </div>
//     </div>
//   `;

//   for (let i = 0; i < store.feeds.length; i++) {
//     if(store.feeds[i].id === Number(id)) {
//       store.feeds[i].read = true;
//       break;
//     }
//   }
  
//   updateView(template.replace('{{__comments__}}', makeComment(newsContent.comments)));
// }

// function makeComment(comments: NewsComment[]): string {
//   const commentString = [];

//   for (let i = 0; i < comments.length; i++) {
//     const comment: NewsComment = comments[i];

//     commentString.push(`
//       <div style="padding-left: ${comment.level * 40}px;" class="mt-4">
//         <div class="text-gray-400">
//           <i class="fa fa-sort-up mr-2"></i>
//           <strong>${comment.user}</strong> ${comment.time_ago}
//         </div>
//         <p class="text-gray-700">${comment.content}</p>
//       </div>
//     `);

//     if (comment.comments.length > 0) {
//       commentString.push(makeComment(comment.comments));
//     }
//   }

//   return commentString.join('');
// }

// function router(): void {
//   const routePath = location.hash;

//   if (routePath === '') {
//     newsFeed();
//   } else if (routePath.indexOf('#/page/') >= 0) {
//     store.currentPage = Number(routePath.substr(7));
//     newsFeed();
//   } else if (routePath.indexOf('#/show/') >= 0) {
//     newsDetail();
//   }
// }

// window.addEventListener('hashchange', router);

// router();